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
// CORS – Firebase Hosting / DEV / local
// =====================
const ALLOWED_ORIGINS = [
  "https://cleanup-manager.fr",
  "https://www.cleanup-manager.fr",
  "https://dev.cleanup-manager.fr",
  "https://cleanup-manager-dev.web.app",
  "https://cleanup-manager-dev.firebaseapp.com",
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
];

function setCors(req, res) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    res.set("Access-Control-Allow-Origin", "https://cleanup-manager.fr");
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, stripe-signature");
  res.set("Access-Control-Allow-Credentials", "true");
}

function getPath(req) {
  try {
    if (req.path) return req.path;
    const u = new URL(req.url, "http://localhost");
    return u.pathname || "/";
  } catch {
    return "/";
  }
}

function ensureJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

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

function planToMaxHomes(plan) {
  switch (String(plan || "").toLowerCase()) {
    case "free":
      return 2;
    case "starter":
      return 5;
    case "pro":
      return 15;
    case "business":
      return 40;
    case "enterprise":
      return 9999;
    default:
      return 2;
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

    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    const path = getPath(req);
    const method = req.method;

    const stripeKey = STRIPE_SECRET.value();
    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
    const stripe = require("stripe")(stripeKey);
    const db = admin.firestore();

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

    // =====================
    // 1) PING
    // =====================
    if (method === "GET" && (path === "/" || path === "")) {
      return res.json({ ok: true, version: "api-v4" });
    }

    // =====================
    // 1bis) ACTIVATE FREE PLAN
    // POST /activate-free-plan
    // body: { uid, email? }
    // =====================
    if (method === "POST" && path === "/activate-free-plan") {
      try {
        const body = ensureJsonBody(req);
        const { uid, email } = body || {};

        if (!uid) {
          return res.status(400).json({ error: "uid requis" });
        }

        const userRef = db.collection("users").doc(uid);
        const snap = await userRef.get();

        if (!snap.exists) {
          return res.status(404).json({ error: "user introuvable" });
        }

        const u = snap.data() || {};

        if (String(u.role || "").toLowerCase() !== "conciergerie") {
          return res.status(403).json({ error: "role non autorisé" });
        }

        if (!u.billingReady) {
          return res.status(400).json({ error: "billingReady requis" });
        }

        const emailNorm = normEmail(email || u.email || "");

        await updateUser(uid, {
          uid,
          email: u.email || emailNorm || "",
          emailLower: u.emailLower || emailNorm || "",
          plan: "free",
          subscriptionStatus: "active",
          subscriptionSource: "FREE_PLAN",
          maxHomes: 2,
          subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return res.json({
          ok: true,
          plan: "free",
          subscriptionStatus: "active",
          subscriptionSource: "FREE_PLAN",
          maxHomes: 2,
        });
      } catch (err) {
        console.error("❌ activate-free-plan error:", {
          message: err?.message,
          code: err?.code,
        });
        return res.status(500).json({ error: "activate free plan failed" });
      }
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
        const planNorm = String(plan || "starter").toLowerCase();

        const origin =
          req.headers.origin && ALLOWED_ORIGINS.includes(req.headers.origin)
            ? req.headers.origin
            : "https://cleanup-manager.fr";

        const basePath = "";

        console.log("create-checkout-session", {
          uid,
          plan: planNorm,
          origin,
          email: emailNorm || null,
          priceId,
        });

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          customer_email: emailNorm || undefined,
          success_url: `${origin}${basePath}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}${basePath}/abonnement.html?cancel=1`,
          metadata: {
            uid,
            plan: planNorm,
          },
          subscription_data: {
            metadata: {
              uid,
              plan: planNorm,
            },
          },
        });

        await db.collection("users").doc(uid).set(
          {
            lastCheckoutSessionId: session.id,
            lastCheckoutAt: admin.firestore.FieldValue.serverTimestamp(),
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
    // 2bis) READ CHECKOUT SESSION
    // GET /checkout-session?session_id=cs_...
    // =====================
    if (method === "GET" && path === "/checkout-session") {
      try {
        const sessionId =
          String(req.query?.session_id || "").trim() ||
          String(
            new URL(req.url, "http://localhost").searchParams.get("session_id") || ""
          ).trim();

        if (!sessionId) {
          return res.status(400).json({ error: "session_id requis" });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

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
        return res
          .status(400)
          .send(`Webhook Error: ${err?.message || "signature invalid"}`);
      }

      try {
        const type = event.type;
        const obj = event.data.object;

        // Checkout validé
        if (type === "checkout.session.completed") {
          const session = obj;
          const uid = session?.metadata?.uid || null;
          const plan = session?.metadata?.plan || "starter";
          const email =
            session?.customer_details?.email || session?.customer_email || null;

          await updateUser(uid, {
            subscriptionStatus: "active",
            subscriptionSource: "stripe",
            subscribedAt: admin.firestore.FieldValue.serverTimestamp(),
            plan,
            maxHomes: planToMaxHomes(plan),
            stripeCustomerId: session.customer || null,
            stripeSubscriptionId: session.subscription || null,
            stripeCustomerEmail: email
              ? normEmail(email)
              : admin.firestore.FieldValue.delete(),
          });
        }

        // Abonnement créé / modifié / supprimé
        if (
          type === "customer.subscription.created" ||
          type === "customer.subscription.updated" ||
          type === "customer.subscription.deleted"
        ) {
          const sub = obj;
          const uid = sub?.metadata?.uid || null;
          const plan = sub?.metadata?.plan || "starter";
          const status = sub.status;
          const isActive = status === "active" || status === "trialing";

          await updateUser(uid, {
            subscriptionStatus: isActive ? "active" : "inactive",
            subscriptionSource: "stripe",
            plan,
            maxHomes: planToMaxHomes(plan),
            stripeSubscriptionId: sub.id,
          });
        }

        // Paiement réussi
        if (type === "invoice.payment_succeeded") {
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
                  subscriptionStatus: "active",
                  subscriptionSource: "stripe",
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            }
          }
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
                  subscriptionSource: "stripe",
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
