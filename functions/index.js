const { onRequest } = require("firebase-functions/v2/https");
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

// =====================
// Secrets Stripe
// =====================
const STRIPE_SECRET = defineSecret("STRIPE_SECRET");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// =====================
// CORS – GitHub Pages
// =====================
const ALLOWED_ORIGINS = ["https://sofy2831.github.io"];

function setCors(req, res) {
  const origin = req.headers.origin;

  // en prod: whitelist stricte
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    // fallback dev (ok)
    res.set("Access-Control-Allow-Origin", origin || "*");
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Credentials", "true");
}

function getPath(req) {
  // robuste (Cloud Run / Functions v2)
  try {
    if (req.path) return req.path;
    const u = new URL(req.url, "http://localhost");
    return u.pathname || "/";
  } catch {
    return "/";
  }
}

function ensureJsonBody(req) {
  // Si express a déjà parsé -> ok
  if (req.body && typeof req.body === "object") return req.body;

  // Sinon, on tente de parser rawBody
  try {
    const raw = req.rawBody ? req.rawBody.toString("utf8") : "";
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// =====================
// Firestore trigger: homes -> users.homesCountActive
// =====================
async function countActiveHomes(conciergerieUid) {
  if (!conciergerieUid) return 0;

  const snap = await admin
    .firestore()
    .collection("homes")
    .where("conciergerieUid", "==", conciergerieUid)
    .get();

  let count = 0;
  snap.forEach((d) => {
    const h = d.data() || {};
    const status = String(h.status || "active").toLowerCase();
    if (status !== "archived") count++;
  });

  return count;
}

async function refreshHomesCount(conciergerieUid) {
  if (!conciergerieUid) return;

  const n = await countActiveHomes(conciergerieUid);

  await admin.firestore().doc(`users/${conciergerieUid}`).set(
    {
      homesCountActive: n,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
}

exports.onHomeWrite = onDocumentWritten(
  { document: "homes/{homeId}", region: "europe-west1" },
  async (event) => {
    const before = event.data?.before?.exists ? (event.data.before.data() || {}) : null;
    const after  = event.data?.after?.exists  ? (event.data.after.data() || {})  : null;

    const beforeUid = before ? String(before.conciergerieUid || "").trim() : "";
    const afterUid  = after  ? String(after.conciergerieUid  || "").trim() : "";

    const uids = new Set();
    if (beforeUid) uids.add(beforeUid);
    if (afterUid) uids.add(afterUid);

    await Promise.all([...uids].map((uid) => refreshHomesCount(uid)));
  }
);

// =====================
// API
// =====================
exports.api = onRequest(
  {
    region: "europe-west1",
    secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET],
  },
  async (req, res) => {
    setCors(req, res);

    // Preflight CORS
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    const path = getPath(req);
    const method = req.method;

    // Stripe init
    const stripeKey = STRIPE_SECRET.value();
    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
    const stripe = require("stripe")(stripeKey);
    const db = admin.firestore();

    // =====================
    // 1) PING
    // =====================
    if (method === "GET" && (path === "/" || path === "")) {
      return res.json({ ok: true, version: "no-example-v1" });
    }

    // =====================
    // 2) CREATE CHECKOUT SESSION
    // POST /create-checkout-session   (car ton base URL = Function URL)
    // =====================
    if (method === "POST" && path === "/create-checkout-session") {
      try {
        const body = ensureJsonBody(req);
        const { uid, plan, priceId } = body || {};

        if (!uid || !priceId) {
          return res.status(400).json({ error: "uid et priceId requis" });
        }

        // Origine pour redirect
        const origin =
          req.headers.origin && req.headers.origin.startsWith("http")
            ? req.headers.origin
            : "https://sofy2831.github.io";

        const basePath = origin.includes("sofy2831.github.io")
          ? "/cleanup-manager"
          : "";

        // LOG utile
        console.log("create-checkout-session", { uid, plan: plan || "starter", origin, basePath });

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: `${origin}${basePath}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}${basePath}/abonnement.html?cancel=1`,
          metadata: { uid, plan: plan || "starter" },
          subscription_data: { metadata: { uid, plan: plan || "starter" } },
        });

        await db.collection("users").doc(uid).set(
          {
            lastCheckoutSessionId: session.id,
            lastCheckoutAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return res.json({ url: session.url });
      } catch (err) {
        // Stripe renvoie souvent err.type + err.raw.message
        console.error("❌ create-checkout-session error:", {
          message: err?.message,
          type: err?.type,
          rawMessage: err?.raw?.message,
          code: err?.code,
        });
        return res.status(500).json({ error: "checkout session failed" });
      }
    }

    // =====================
    // 3) STRIPE WEBHOOK
    // POST /webhook
    // =====================
    if (method === "POST" && path === "/webhook") {
      let event;

      try {
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
      } catch (err) {
        console.error("❌ Webhook signature error:", err?.message || err);
        return res.status(400).send(`Webhook Error: ${err?.message || "signature invalid"}`);
      }

      try {
        const type = event.type;
        const obj = event.data.object;

        async function updateUser(uid, data) {
          if (!uid) return;
          await db.collection("users").doc(uid).set(
            {
              ...data,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        if (type === "checkout.session.completed") {
          const session = obj;
          const uid = session?.metadata?.uid || null;
          const plan = session?.metadata?.plan || "starter";

          await updateUser(uid, {
            subscriptionStatus: "active",
            plan,
            stripeCustomerId: session.customer || null,
            stripeSubscriptionId: session.subscription || null,
          });
        }

        if (
          type === "customer.subscription.created" ||
          type === "customer.subscription.updated" ||
          type === "customer.subscription.deleted"
        ) {
          const sub = obj;
          const uid = sub?.metadata?.uid || null;
          const status = sub.status;
          const isActive = status === "active" || status === "trialing";

          await updateUser(uid, {
            subscriptionStatus: isActive ? "active" : "inactive",
            stripeSubscriptionId: sub.id,
          });
        }

        if (type === "invoice.payment_failed") {
          const invoice = obj;
          const subId = invoice.subscription;

          if (subId) {
            const snap = await db
              .collection("users")
              .where("stripeSubscriptionId", "==", subId)
              .limit(1)
              .get();

            if (!snap.empty) {
              await snap.docs[0].ref.set(
                {
                  subscriptionStatus: "inactive",
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            }
          }
        }

        return res.json({ received: true });
      } catch (err) {
        console.error("❌ webhook handler error:", err?.message || err);
        return res.status(500).json({ error: "Webhook handler failed" });
      }
    }

    // =====================
    // 404
    // =====================
    return res.status(404).json({ error: "Not found", path });
  }
);
