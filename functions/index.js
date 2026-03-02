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

  // prod: whitelist stricte
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    // fallback dev
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
  // express/json déjà passé
  if (req.body && typeof req.body === "object") return req.body;

  // sinon parse rawBody
  try {
    const raw = req.rawBody ? req.rawBody.toString("utf8") : "";
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function normEmail(s) {
  return String(s || "").trim().toLowerCase();
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
    const before = event.data?.before?.exists
      ? (event.data.before.data() || {})
      : null;
    const after = event.data?.after?.exists
      ? (event.data.after.data() || {})
      : null;

    const beforeUid = before ? String(before.conciergerieUid || "").trim() : "";
    const afterUid = after ? String(after.conciergerieUid || "").trim() : "";

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

    // Preflight
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
      return res.json({ ok: true, version: "api-v2" });
    }

    // =====================
    // 2) CREATE CHECKOUT SESSION
    // POST /create-checkout-session
    // body: { uid, email, plan, priceId }
    // =====================
    if (method === "POST" && path === "/create-checkout-session") {
      try {
        const body = ensureJsonBody(req);
        const { uid, plan, priceId, email } = body || {};

        if (!uid || !priceId) {
          return res.status(400).json({ error: "uid et priceId requis" });
        }

        const emailNorm = normEmail(email);

        // Origine pour redirect
        const origin =
          req.headers.origin && req.headers.origin.startsWith("http")
            ? req.headers.origin
            : "https://sofy2831.github.io";

        const basePath = origin.includes("sofy2831.github.io")
          ? "/cleanup-manager"
          : "";

        console.log("create-checkout-session", {
          uid,
          plan: plan || "starter",
          origin,
          basePath,
          email: emailNorm || null,
        });

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],

          // ✅ IMPORTANT : facilite support + rapproche Stripe <-> Firestore
          customer_email: emailNorm || undefined,

          success_url: `${origin}${basePath}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}${basePath}/abonnement.html?cancel=1`,

          metadata: { uid, plan: plan || "starter" },
          subscription_data: {
            metadata: { uid, plan: plan || "starter" },
          },
        });

        await db.collection("users").doc(uid).set(
          {
            lastCheckoutSessionId: session.id,
            lastCheckoutAt: admin.firestore.FieldValue.serverTimestamp(),
            // utile support
            stripeCustomerEmail: emailNorm || admin.firestore.FieldValue.delete(),
          },
          { merge: true }
        );

        return res.json({ url: session.url });
      } catch (err) {
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
    // 2bis) READ CHECKOUT SESSION (pour merci.html)
    // GET /checkout-session?session_id=cs_...
    // =====================
    if (method === "GET" && path === "/checkout-session") {
      try {
        const sessionId =
          String(req.query?.session_id || "").trim() ||
          String(new URL(req.url, "http://localhost").searchParams.get("session_id") || "").trim();

        if (!sessionId) {
          return res.status(400).json({ error: "session_id requis" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // On renvoie juste le strict nécessaire au front
        const plan = session?.metadata?.plan || "starter";
        const uid = session?.metadata?.uid || null;

        return res.json({
          id: session.id,
          uid,
          plan,
          payment_status: session.payment_status || null,
          status: session.status || null,
          customer_email: session.customer_details?.email || session.customer_email || null,
          customer: session.customer || null,
          subscription: session.subscription || null,
          livemode: !!session.livemode,
        });
      } catch (err) {
        console.error("❌ checkout-session retrieve error:", {
          message: err?.message,
          type: err?.type,
          rawMessage: err?.raw?.message,
          code: err?.code,
        });
        return res.status(500).json({ error: "checkout session read failed" });
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

        // Checkout validé
        if (type === "checkout.session.completed") {
          const session = obj;
          const uid = session?.metadata?.uid || null;
          const plan = session?.metadata?.plan || "starter";
          const email =
            session?.customer_details?.email || session?.customer_email || null;

          await updateUser(uid, {
            subscriptionStatus: "active",
            plan,
            stripeCustomerId: session.customer || null,
            stripeSubscriptionId: session.subscription || null,
            stripeCustomerEmail: email ? normEmail(email) : admin.firestore.FieldValue.delete(),
          });
        }

        // Abonnement modifié/supprimé
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

        // Paiement échoué
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
