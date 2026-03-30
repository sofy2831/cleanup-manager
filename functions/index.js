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
// Environnement projet
// =====================
const PROJECT_ID =
  process.env.GCLOUD_PROJECT ||
  process.env.GCP_PROJECT ||
  "";

const IS_DEV_PROJECT =
  PROJECT_ID === "cleanup-manager-dev" ||
  PROJECT_ID === "cleanup-manager-d9301" ||
  PROJECT_ID.includes("-dev");

// =====================
// Stripe price IDs
// =====================
const PRICE_IDS = IS_DEV_PROJECT
  ? {
      starter: "price_1TDnNAAB1M9iCDJFi6bipg2U",
      pro: "price_1TDnQQAB1M9iCDJFbsWcAfgp",
      business: "price_1TDnRqAB1M9iCDJFhRkyk4Ua",
    }
  : {
      starter: "price_1TDskOAB1M9iCDJF4Lltjn1s",
      pro: "price_1TDslzAB1M9iCDJFvd8tBxyY",
      business: "price_1TDsnnAB1M9iCDJFdOJEuZRk",
    };

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
  res.set(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, stripe-signature"
  );
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

function getPriceIdForPlan(plan) {
  switch (String(plan || "").toLowerCase()) {
    case "starter":
      return PRICE_IDS.starter || null;
    case "pro":
      return PRICE_IDS.pro || null;
    case "business":
      return PRICE_IDS.business || null;
    default:
      return null;
  }
}

function getPlanFromPriceId(priceId) {
  const id = String(priceId || "").trim();

  if (id === PRICE_IDS.starter) return "starter";
  if (id === PRICE_IDS.pro) return "pro";
  if (id === PRICE_IDS.business) return "business";

  return "starter";
}

function stripeUnixToTimestamp(unixSeconds) {
  const n = Number(unixSeconds);
  if (!Number.isFinite(n) || n <= 0) return null;
  return admin.firestore.Timestamp.fromMillis(n * 1000);
}

function getCurrentPeriodEndTimestamp(sub) {
  const direct = stripeUnixToTimestamp(sub?.current_period_end);
  if (direct) return direct;

  const itemCurrent = stripeUnixToTimestamp(
    sub?.items?.data?.[0]?.current_period_end
  );
  if (itemCurrent) return itemCurrent;

  return null;
}

function mapStripeSubscriptionStatus(sub) {
  const status = String(sub?.status || "").toLowerCase();
  const cancelAtPeriodEnd = sub?.cancel_at_period_end === true;

  if (cancelAtPeriodEnd && (status === "active" || status === "trialing")) {
    return "cancel_at_period_end";
  }

  if (status === "active" || status === "trialing") {
    return "active";
  }

  if (status === "past_due" || status === "unpaid" || status === "incomplete") {
    return "suspended";
  }

  if (status === "canceled" || status === "incomplete_expired") {
    return "cancelled";
  }

  return "suspended";
}

// =====================
// Stats helpers
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

async function countHomes(conciergerieUid) {
  if (!conciergerieUid) return 0;

  const snap = await admin
    .firestore()
    .collection("homes")
    .where("conciergerieUid", "==", conciergerieUid)
    .get();

  return snap.size || 0;
}

async function countOwners(conciergerieUid) {
  if (!conciergerieUid) return 0;

  const snap = await admin
    .firestore()
    .collection("owners")
    .where("conciergerieUid", "==", conciergerieUid)
    .get();

  return snap.size || 0;
}

async function countAgents(conciergerieUid) {
  if (!conciergerieUid) return 0;

  const snap = await admin
    .firestore()
    .collection("agents")
    .where("conciergerieUid", "==", conciergerieUid)
    .get();

  let count = 0;
  snap.forEach((d) => {
    const a = d.data() || {};
    const status = String(a.status || "active").toLowerCase();
    if (status !== "archived" && status !== "inactive") count++;
  });

  return count;
}

async function rebuildStatsFor(conciergerieUid) {
  if (!conciergerieUid) return;

  const db = admin.firestore();
  const userRef = db.doc(`users/${conciergerieUid}`);
  const userSnap = await userRef.get();
  const user = userSnap.exists ? (userSnap.data() || {}) : {};

  const [homesCount, activeHomes, ownersCount, agentsCount] = await Promise.all([
    countHomes(conciergerieUid),
    countActiveHomes(conciergerieUid),
    countOwners(conciergerieUid),
    countAgents(conciergerieUid),
  ]);

  const plan = String(user.plan || "free").toLowerCase();
  const maxHomes =
    Number.isFinite(Number(user.maxHomes)) && Number(user.maxHomes) > 0
      ? Number(user.maxHomes)
      : planToMaxHomes(plan);

  const payload = {
    conciergerieUid,
    homesCount,
    activeHomes,
    ownersCount,
    agentsCount,
    maxHomes,
    plan,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await Promise.all([
    db.doc(`statsConciergerie/${conciergerieUid}`).set(payload, { merge: true }),
    userRef.set(
      {
        homesCountActive: activeHomes,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

// =====================
// Firestore triggers
// =====================
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

    await Promise.all([...uids].map((uid) => rebuildStatsFor(uid)));
  }
);

exports.onOwnerWrite = onDocumentWritten(
  { document: "owners/{ownerId}", region: "europe-west1" },
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

    await Promise.all([...uids].map((uid) => rebuildStatsFor(uid)));
  }
);

exports.onAgentWrite = onDocumentWritten(
  { document: "agents/{agentId}", region: "europe-west1" },
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

    await Promise.all([...uids].map((uid) => rebuildStatsFor(uid)));
  }
);

// =====================
// iCal fetch proxy
// =====================
exports.fetchIcal = onRequest(
  {
    region: "europe-west1",
    cors: true,
    timeoutSeconds: 60,
    memory: "256MiB",
  },
  async (req, res) => {
    try {
      let url = String(req.query.url || "").trim();

      if (!url) {
        return res.status(400).json({ error: "URL iCal manquante" });
      }

      if (/^webcal:\/\//i.test(url)) {
        url = url.replace(/^webcal:\/\//i, "https://");
      }

      if (!/^https:\/\//i.test(url)) {
        return res.status(400).json({
          error: "Le lien doit commencer par https://"
        });
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "CleanUpManager/1.0",
          "Accept": "text/calendar,text/plain,*/*"
        }
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Lecture iCal impossible (HTTP ${response.status})`
        });
      }

      const text = await response.text();

      if (!text.includes("BEGIN:VCALENDAR")) {
        return res.status(400).json({
          error: "Le contenu récupéré n'est pas un iCal valide"
        });
      }

      res.set("Content-Type", "text/plain; charset=utf-8");
      return res.status(200).send(text);

    } catch (error) {
      console.error("fetchIcal error:", error);
      return res.status(500).json({
        error: "Impossible de récupérer le lien iCal"
      });
    }
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

    async function findUserBySubscriptionId(subscriptionId) {
      if (!subscriptionId) return null;

      const snap = await db
        .collection("users")
        .where("stripeSubscriptionId", "==", subscriptionId)
        .limit(1)
        .get();

      if (snap.empty) return null;

      return {
        uid: snap.docs[0].id,
        ref: snap.docs[0].ref,
        data: snap.docs[0].data() || {},
      };
    }

    // =====================
    // 1) PING
    // =====================
    if (method === "GET" && (path === "/" || path === "")) {
      return res.json({
        ok: true,
        version: "api-v7",
        projectId: PROJECT_ID || null,
        mode: IS_DEV_PROJECT ? "dev" : "prod",
      });
    }

    // =====================
    // 1bis) ACTIVATE FREE PLAN
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
          stripeSubscriptionId: admin.firestore.FieldValue.delete(),
          stripeCustomerId: admin.firestore.FieldValue.delete(),
          cancelAtPeriodEnd: false,
          cancelReason: admin.firestore.FieldValue.delete(),
          cancelComment: admin.firestore.FieldValue.delete(),
          cancelRequestedAt: admin.firestore.FieldValue.delete(),
          currentPeriodEnd: admin.firestore.FieldValue.delete(),
        });

        await rebuildStatsFor(uid);

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
    // =====================
    if (method === "POST" && path === "/create-checkout-session") {
      try {
        const body = ensureJsonBody(req);
        const { uid, plan, email } = body || {};

        const planNorm = String(plan || "starter").toLowerCase().trim();
        const priceId = getPriceIdForPlan(planNorm);

        console.log("🔥 CHECKOUT INPUT", {
          uid: uid || null,
          plan: planNorm || null,
          email: email || null,
          projectId: PROJECT_ID || null,
          isDevProject: IS_DEV_PROJECT,
          priceId: priceId || null,
          stripeKeyMode: String(stripeKey || "").startsWith("sk_test_") ? "test" : "live",
        });

        if (!uid || !planNorm || !priceId) {
          return res.status(400).json({
            error: "uid et plan valides requis",
            plan: planNorm || null,
            mode: IS_DEV_PROJECT ? "dev" : "prod",
          });
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
          return res.status(404).json({ error: "user introuvable" });
        }

        const userData = userSnap.data() || {};

        if (String(userData.role || "").toLowerCase() !== "conciergerie") {
          return res.status(403).json({ error: "role non autorisé" });
        }

        if (!userData.billingReady) {
          return res.status(400).json({ error: "billingReady requis" });
        }

        const hasSubscription =
          String(userData.stripeSubscriptionId || "").trim().length > 0 &&
          ["active", "cancel_at_period_end", "suspended"].includes(
            String(userData.subscriptionStatus || "").toLowerCase()
          );

        if (hasSubscription) {
          return res.status(409).json({
            error: "subscription_exists",
            subscriptionStatus: userData.subscriptionStatus || null,
            redirectToPortal: true,
          });
        }

        const emailNorm = normEmail(email || userData.email || "");

        const origin =
          req.headers.origin && ALLOWED_ORIGINS.includes(req.headers.origin)
            ? req.headers.origin
            : "https://cleanup-manager.fr";

        const stripePrice = await stripe.prices.retrieve(priceId);
        console.log("💰 STRIPE PRICE FOUND", {
          id: stripePrice?.id || null,
          active: stripePrice?.active || false,
          livemode: stripePrice?.livemode || false,
          currency: stripePrice?.currency || null,
          recurring: stripePrice?.recurring?.interval || null,
          product: stripePrice?.product || null,
        });

        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: priceId, quantity: 1 }],
          customer_email: emailNorm || undefined,
          success_url: `${origin}/merci.html?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${origin}/abonnement.html?cancel=1`,
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

        return res.json({
          ok: true,
          url: session.url,
          mode: session.livemode ? "live" : "test",
        });
      } catch (err) {
        console.error("❌ create-checkout-session error:", {
          message: err?.message,
          type: err?.type,
          rawMessage: err?.raw?.message,
          code: err?.code,
          stripeKeyMode: String(stripeKey || "").startsWith("sk_test_") ? "test" : "live",
          projectId: PROJECT_ID || null,
          isDevProject: IS_DEV_PROJECT,
        });
        return res.status(500).json({ error: "checkout session failed" });
      }
    }

    // =====================
    // 2bis) READ CHECKOUT SESSION
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
          customer_email:
            session.customer_details?.email || session.customer_email || null,
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
    // 2ter) CANCEL SUBSCRIPTION
    // =====================
    if (method === "POST" && path === "/cancel-subscription") {
      try {
        const body = ensureJsonBody(req);
        const { uid, reason, comment } = body || {};

        if (!uid) {
          return res.status(400).json({ error: "uid requis" });
        }

        if (!reason) {
          return res.status(400).json({ error: "reason requis" });
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
          return res.status(404).json({ error: "user introuvable" });
        }

        const user = userSnap.data() || {};
        const subscriptionId = String(user.stripeSubscriptionId || "").trim();

        if (!subscriptionId) {
          return res.status(400).json({ error: "subscription introuvable" });
        }

        const sub = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });

        await updateUser(uid, {
          subscriptionStatus: "cancel_at_period_end",
          cancelAtPeriodEnd: true,
          cancelReason: String(reason || "").trim(),
          cancelComment: String(comment || "").trim(),
          cancelRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
          currentPeriodEnd: getCurrentPeriodEndTimestamp(sub),
          stripeSubscriptionId: sub.id,
          stripeCustomerId: sub.customer || null,
        });

        return res.json({
          ok: true,
          subscriptionStatus: "cancel_at_period_end",
          currentPeriodEnd: sub?.current_period_end || null,
        });
      } catch (err) {
        console.error("❌ cancel-subscription error:", {
          message: err?.message,
          type: err?.type,
          rawMessage: err?.raw?.message,
          code: err?.code,
        });
        return res.status(500).json({ error: "cancel subscription failed" });
      }
    }
    // =====================
    // 2ter-bis) REACTIVATE SUBSCRIPTION
    // POST /reactivate-subscription
    // body: { uid }
    // =====================
    if (method === "POST" && path === "/reactivate-subscription") {
      try {
        const body = ensureJsonBody(req);
        const { uid } = body || {};

        if (!uid) {
          return res.status(400).json({ error: "uid requis" });
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
          return res.status(404).json({ error: "user introuvable" });
        }

        const user = userSnap.data() || {};
        const subscriptionId = String(user.stripeSubscriptionId || "").trim();

        if (!subscriptionId) {
          return res.status(400).json({ error: "subscription introuvable" });
        }

        const currentStatus = String(user.subscriptionStatus || "").toLowerCase();

        if (currentStatus !== "cancel_at_period_end") {
          return res.status(400).json({
            error: "abonnement non réactivable",
            subscriptionStatus: currentStatus || null,
          });
        }

        const sub = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: false,
        });

        await updateUser(uid, {
          subscriptionStatus: mapStripeSubscriptionStatus(sub),
          cancelAtPeriodEnd: false,
          cancelReason: admin.firestore.FieldValue.delete(),
          cancelComment: admin.firestore.FieldValue.delete(),
          cancelRequestedAt: admin.firestore.FieldValue.delete(),
          currentPeriodEnd: getCurrentPeriodEndTimestamp(sub),
          stripeSubscriptionId: sub.id,
          stripeCustomerId: sub.customer || null,
        });

        await rebuildStatsFor(uid);

        return res.json({
          ok: true,
          subscriptionStatus: mapStripeSubscriptionStatus(sub),
          currentPeriodEnd: sub?.current_period_end || null,
        });
      } catch (err) {
        console.error("❌ reactivate-subscription error:", {
          message: err?.message,
          type: err?.type,
          rawMessage: err?.raw?.message,
          code: err?.code,
        });
        return res.status(500).json({ error: "reactivate subscription failed" });
      }
    }
    // =====================
    // 3) STRIPE WEBHOOK
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

        // =====================
        // Checkout validé
        // =====================
        if (type === "checkout.session.completed") {
          const session = obj;
          const uid = session?.metadata?.uid || null;
          const plan = session?.metadata?.plan || "starter";
          const email =
            session?.customer_details?.email || session?.customer_email || null;

          let stripeSub = null;
          const stripeSubId = String(session?.subscription || "").trim();

          if (stripeSubId) {
            try {
              stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
            } catch (e) {
              console.error("❌ checkout.session.completed subscription retrieve error:", {
                message: e?.message,
                code: e?.code,
                subscriptionId: stripeSubId,
              });
            }
          }

          const appStatus = stripeSub
            ? mapStripeSubscriptionStatus(stripeSub)
            : "active";

          await updateUser(uid, {
            subscriptionStatus: appStatus,
            subscriptionSource: "stripe",
            subscribedAt: stripeSub?.created
              ? stripeUnixToTimestamp(stripeSub.created)
              : admin.firestore.FieldValue.serverTimestamp(),
            plan,
            maxHomes: planToMaxHomes(plan),
            stripeCustomerId: stripeSub?.customer || session.customer || null,
            stripeSubscriptionId: stripeSub?.id || session.subscription || null,
            stripeCustomerEmail: email
              ? normEmail(email)
              : admin.firestore.FieldValue.delete(),
            cancelAtPeriodEnd: stripeSub?.cancel_at_period_end === true,
            currentPeriodEnd: getCurrentPeriodEndTimestamp(stripeSub),
            cancelReason: admin.firestore.FieldValue.delete(),
            cancelComment: admin.firestore.FieldValue.delete(),
            cancelRequestedAt: admin.firestore.FieldValue.delete(),
          });

          await rebuildStatsFor(uid);
        }

        // =====================
        // Abonnement créé / modifié / supprimé
        // =====================
        if (
          type === "customer.subscription.created" ||
          type === "customer.subscription.updated" ||
          type === "customer.subscription.deleted"
        ) {
          const sub = obj;

          let uid = String(sub?.metadata?.uid || "").trim() || null;

          if (!uid && sub?.id) {
            const found = await findUserBySubscriptionId(sub.id);
            if (found?.uid) uid = found.uid;
          }

          if (!uid) {
            console.error("❌ subscription webhook: uid introuvable", {
              type,
              subscriptionId: sub?.id || null,
              customerId: sub?.customer || null,
            });
          } else {
            let fullSub = sub;

            try {
              fullSub = await stripe.subscriptions.retrieve(sub.id);
            } catch (e) {
              console.error("❌ subscription retrieve error:", {
                message: e?.message,
                code: e?.code,
                subscriptionId: sub?.id || null,
              });
            }

            const currentPriceId =
              fullSub?.items?.data?.[0]?.price?.id ||
              fullSub?.plan?.id ||
              null;

            console.log("📅 SUB PERIOD DEBUG", {
              subscriptionId: fullSub?.id || null,
              current_period_end: fullSub?.current_period_end || null,
              item_current_period_end:
                fullSub?.items?.data?.[0]?.current_period_end || null,
            });

            const plan = getPlanFromPriceId(currentPriceId);
            const appStatus = mapStripeSubscriptionStatus(fullSub);

            const updatePayload = {
              subscriptionStatus: appStatus,
              subscriptionSource: "stripe",
              plan,
              maxHomes: planToMaxHomes(plan),
              stripeSubscriptionId: fullSub.id,
              stripeCustomerId: fullSub.customer || null,
              cancelAtPeriodEnd: fullSub?.cancel_at_period_end === true,
              currentPeriodEnd: getCurrentPeriodEndTimestamp(fullSub),
              subscribedAt: fullSub?.created
                ? stripeUnixToTimestamp(fullSub.created)
                : admin.firestore.FieldValue.serverTimestamp(),
            };

            // si abonnement toujours actif / changé d'offre => on nettoie les champs de résiliation
            if (appStatus === "active") {
              updatePayload.cancelReason = admin.firestore.FieldValue.delete();
              updatePayload.cancelComment = admin.firestore.FieldValue.delete();
              updatePayload.cancelRequestedAt = admin.firestore.FieldValue.delete();
            }

            await updateUser(uid, updatePayload);

            await rebuildStatsFor(uid);
          }
        }

        // =====================
        // Paiement réussi
        // =====================
        if (type === "invoice.payment_succeeded") {
          const invoice = obj;
          const subId = invoice.subscription;

          if (subId) {
            const found = await findUserBySubscriptionId(subId);

            if (found?.uid) {
              let stripeSub = null;
              try {
                stripeSub = await stripe.subscriptions.retrieve(subId);
              } catch (e) {
                console.error("❌ invoice.payment_succeeded subscription retrieve error:", {
                  message: e?.message,
                  code: e?.code,
                  subscriptionId: subId,
                });
              }

              await found.ref.set(
                {
                  subscriptionStatus: stripeSub
                    ? mapStripeSubscriptionStatus(stripeSub)
                    : "active",
                  subscriptionSource: "stripe",
                  cancelAtPeriodEnd: stripeSub?.cancel_at_period_end === true,
                  currentPeriodEnd: getCurrentPeriodEndTimestamp(stripeSub),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              await rebuildStatsFor(found.uid);
            }
          }
        }

        // =====================
        // Paiement échoué
        // =====================
        if (type === "invoice.payment_failed") {
          const invoice = obj;
          const subId = invoice.subscription;

          if (subId) {
            const found = await findUserBySubscriptionId(subId);

            if (found?.uid) {
              let stripeSub = null;
              try {
                stripeSub = await stripe.subscriptions.retrieve(subId);
              } catch (e) {
                console.error("❌ invoice.payment_failed subscription retrieve error:", {
                  message: e?.message,
                  code: e?.code,
                  subscriptionId: subId,
                });
              }

              await found.ref.set(
                {
                  subscriptionStatus: "suspended",
                  subscriptionSource: "stripe",
                  cancelAtPeriodEnd: stripeSub?.cancel_at_period_end === true,
                  currentPeriodEnd: getCurrentPeriodEndTimestamp(stripeSub),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
                { merge: true }
              );

              await rebuildStatsFor(found.uid);
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
    // 2quater) BILLING PORTAL
    // =====================
    if (method === "POST" && path === "/create-billing-portal-session") {
      try {
        const body = ensureJsonBody(req);
        const { uid } = body || {};

        if (!uid) {
          return res.status(400).json({ error: "uid requis" });
        }

        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
          return res.status(404).json({ error: "user introuvable" });
        }

        const userData = userSnap.data() || {};
        const customerId = String(userData.stripeCustomerId || "").trim();
        const subscriptionStatus = String(userData.subscriptionStatus || "").toLowerCase();

        if (!customerId) {
          return res.status(400).json({ error: "stripeCustomerId introuvable" });
        }

        if (!["active", "cancel_at_period_end", "suspended"].includes(subscriptionStatus)) {
          return res.status(400).json({
            error: "abonnement non éligible au portail",
            subscriptionStatus: subscriptionStatus || null,
          });
        }

        const origin =
          req.headers.origin && ALLOWED_ORIGINS.includes(req.headers.origin)
            ? req.headers.origin
            : "https://cleanup-manager.fr";

        const session = await stripe.billingPortal.sessions.create({
          customer: customerId,
          return_url: `${origin}/conciergerie.html`,
        });

        return res.json({
          ok: true,
          url: session.url,
        });
      } catch (err) {
        console.error("❌ create-billing-portal-session error:", {
          message: err?.message,
          type: err?.type,
          rawMessage: err?.raw?.message,
          code: err?.code,
        });
        return res.status(500).json({ error: "billing portal session failed" });
      }
    }

    // =====================
    // 404
    // =====================
    return res.status(404).json({ error: "Not found", path });
  }
);
