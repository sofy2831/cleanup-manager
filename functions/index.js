const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const admin = require("firebase-admin");

admin.initializeApp();

const STRIPE_SECRET = defineSecret("STRIPE_SECRET");
const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// ✅ Mets ton domaine GitHub Pages ici (ou "*" temporaire)
const ALLOWED_ORIGINS = [
  "https://github.com/sofy2831/cleanup-manager",
  "https://github.com/sofy2831/cleanup-manager", // parfois nécessaire selon basepath
];

function setCors(req, res) {
  const origin = req.headers.origin;

  // ✅ Debug rapide : autorise tout en DEV si tu veux
  // res.set("Access-Control-Allow-Origin", origin || "*");

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  } else {
    // temporaire pour débloquer (moins secure)
    res.set("Access-Control-Allow-Origin", origin || "*");
  }

  res.set("Vary", "Origin");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

exports.api = onRequest(
  { region: "europe-west1", secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET] },
  async (req, res) => {
    setCors(req, res);

    // ✅ préflight CORS
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    const stripe = require("stripe")(STRIPE_SECRET.value());
    const webhookSecret = STRIPE_WEBHOOK_SECRET.value();
    const db = admin.firestore();

    // =========================================================
    // 1) PING
    // =========================================================
    if (req.method === "GET" && req.path === "/") {
      return res.json({ ok: true, path: req.path, method: req.method });
    }

    // =========================================================
    // 2) CREATE CHECKOUT SESSION (appelé par TON FRONT)
    // POST https://.../api/create-checkout-session
    // body: { uid, plan, priceId, successUrl, cancelUrl }
    // =========================================================
    if (req.method === "POST" && req.path === "/create-checkout-session") {
      try {
        const { uid, plan, priceId, successUrl, cancelUrl } = req.body || {};

        if (!uid || !priceId) {
          return res.status(400).json({ error: "uid et priceId requis" });
        }

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          success_url: successUrl || "https://github.com/sofy2831/cleanup-manager/merci.html",
          cancel_url: cancelUrl || "https://github.com/sofy2831/cleanup-managerabonnement.html?cancel=1",
          metadata: { uid, plan: plan || "starter" },
          subscription_data: { metadata: { uid, plan: plan || "starter" } },
        });

        // Optionnel: trace Firestore
        await db.collection("users").doc(uid).set(
          {
            lastCheckoutSessionId: session.id,
            lastCheckoutAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return res.json({ url: session.url });
      } catch (err) {
        console.error("❌ create-checkout-session error:", err);
        return res.status(500).json({ error: "checkout session failed" });
      }
    }

    // =========================================================
    // 3) STRIPE WEBHOOK (Stripe seulement)
    // POST https://.../api/webhook
    // =========================================================
    if (req.method === "POST" && req.path === "/webhook") {
      let event;
      try {
        const sig = req.headers["stripe-signature"];
        event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
      } catch (err) {
        console.error("❌ signature failed:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
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
          const plan = session?.metadata?.plan || "illimite";

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
        console.error("❌ webhook handler error:", err);
        return res.status(500).json({ error: "Webhook handler failed" });
      }
    }

    return res.status(404).json({ error: "Not found", path: req.path });
  }
);