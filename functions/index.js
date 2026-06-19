const { onRequest } = require("firebase-functions/v2/https");ccc
const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
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

const IS_DEV_PROJECT = PROJECT_ID === "cleanup-manager-dev";

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
// Stripe boutique (shop) price IDs
// =====================
const SHOP_PRICE_IDS = IS_DEV_PROJECT
  ? {
      kit_ess: "price_1TIVH5AMMazMXNc1eXlKmTYr",
      kit_cuis: "price_1TIVJxAMMazMXNc1ycyEMrd4",
      kit_bain: "price_1TIVL5AMMazMXNc1e5NF1029",
      kit_sej: "price_1TIVM8AMMazMXNc14yWtnNym",

      u_1: "price_1TIVOHAMMazMXNc1W9qiSMho",
      u_2: "price_1TIVPjAMMazMXNc1iuhegcPW",
      u_3: "price_1TIVQyAMMazMXNc1lSRKw5fA",
      u_4: "price_1TIVSNAMMazMXNc1lRbAcZkY",
      u_5: "price_1TIVTVAMMazMXNc14gciTFfs",
      u_6: "price_1TIVUVAMMazMXNc15uJM9Kgx",
      u_7: "price_1TIVVhAMMazMXNc1mfQIn5z0",
      u_8: "price_1TIVWvAMMazMXNc1I8OGkaSM",
      u_9: "price_1TIVXnAMMazMXNc1nPGhLkH0",
      u_10: "price_1TIVZWAMMazMXNc1EBYPc6Kn",
      u_11: "price_1TIVaLAMMazMXNc1wNIRZRFc",
      u_12: "price_1TIVbJAMMazMXNc1k03PiXjp",
      u_13: "price_1TIVcLAMMazMXNc1GPf6MdA7",
      u_14: "price_1TIVd7AMMazMXNc1M5XbUMo1",
      u_15: "price_1TIVe6AMMazMXNc1hoBsZHKB",
      u_16: "price_1TIVerAMMazMXNc1VpoU41BQ",
      u_17: "price_1TIVfWAMMazMXNc11j42JYMm",
      u_18: "price_1TIVgCAMMazMXNc1Z2deb05r",
      u_19: "price_1TIVgqAMMazMXNc1PgDUh5dV",
      u_20: "price_1TIVhjAMMazMXNc1efqCaDYb",
      u_21: "price_1TIViLAMMazMXNc1UZDen24a",

      shipping: "price_1TIVjWAMMazMXNc1TOW80j9H",
    }
  : {
      // À renseigner plus tard avec les vrais price_ live
      kit_ess: "price_1TIoQJAB1M9iCDJFPfxPCFEZ",
      kit_cuis: "price_1TIoTeAB1M9iCDJFHgtcgpXy",
      kit_bain: "price_1TIoVBAB1M9iCDJFa4wutFhS",
      kit_sej: "price_1TIozuAB1M9iCDJFqYaX6AnC",

      u_1: "price_1TIoVyAB1M9iCDJFzL9nTYAa",
      u_2: "price_1TIoWUAB1M9iCDJFCfFgqKFJ",
      u_3: "price_1TIoXGAB1M9iCDJFreT4j7kq",
      u_4: "price_1TIoXkAB1M9iCDJFgBQ4TdMk",
      u_5: "price_1TIoYLAB1M9iCDJFOKViZfxH",
      u_6: "price_1TIoYtAB1M9iCDJF58weinny",
      u_7: "price_1TIoZVAB1M9iCDJFaEZecZ8i",
      u_8: "price_1TIoa1AB1M9iCDJF9jRvn53X",
      u_9: "price_1TIoaVAB1M9iCDJFwQnZ9JT3",
      u_10: "price_1TIob1AB1M9iCDJFmWgOcEUO",
      u_11: "price_1TIobTAB1M9iCDJFsVxz148E",
      u_12: "price_1TIobtAB1M9iCDJFqLSqrkLs",
      u_13: "price_1TIocNAB1M9iCDJFjKVJTdq3",
      u_14: "price_1TIocqAB1M9iCDJFR2PGwugJ",
      u_15: "price_1TIoduAB1M9iCDJFnYdZa8Fw",
      u_16: "price_1TIoecAB1M9iCDJFdXwLQGMw",
      u_17: "price_1TIof4AB1M9iCDJFSfm1CxcL",
      u_18: "price_1TIofZAB1M9iCDJFp87R48tt",
      u_19: "price_1TIofzAB1M9iCDJFKLpnqpIE",
      u_20: "price_1TIogSAB1M9iCDJF6UIGS6jg",
      u_21: "price_1TIogvAB1M9iCDJFA1kuQsuT",

      shipping: "price_1TIohPAB1M9iCDJFdkstcxCV",
    };

// =====================
// Catalogue boutique (montants en centimes)
// =====================
const SHOP_CATALOG = {
  kit_ess: { name: "Kit essentiel", unitAmount: 490 },
  kit_cuis: { name: "Kit cuisine", unitAmount: 590 },
  kit_bain: { name: "Kit bain", unitAmount: 420 },
  kit_sej: { name: "Kit séjour (2 pers)", unitAmount: 1390 },

  u_1: { name: "Tampon à récurer", unitAmount: 20 },
  u_2: { name: "Torchon", unitAmount: 128 },
  u_3: { name: "30ml de liquide vaisselle", unitAmount: 56 },
  u_4: { name: "Sac poubelle 50L", unitAmount: 24 },
  u_5: { name: "Capsule pour lave-linge", unitAmount: 43 },
  u_6: { name: "Pastille pour lave-vaisselle", unitAmount: 19 },
  u_7: { name: "Nettoyant multi usage sol + surface 30ml", unitAmount: 60 },
  u_8: { name: "Capsule Café", unitAmount: 39 },
  u_9: { name: "Sachet de Thé", unitAmount: 20 },
  u_10: { name: "Sucre monodose", unitAmount: 7 },
  u_11: { name: "Lait monodose", unitAmount: 20 },
  u_12: { name: "Nesquick", unitAmount: 60 },
  u_13: { name: "Huile olive 20ml", unitAmount: 78 },
  u_14: { name: "Vinaigre xérès 20ml", unitAmount: 39 },
  u_15: { name: "Sel + poivre", unitAmount: 10 },
  u_16: { name: "Essuie tout", unitAmount: 116 },
  u_17: { name: "Papier toilette", unitAmount: 56 },
  u_18: { name: "Gel douche", unitAmount: 27 },
  u_19: { name: "Shampoing", unitAmount: 27 },
  u_20: { name: "Savon mains", unitAmount: 15 },
  u_21: { name: "Après-shampoing", unitAmount: 29 },
};

const SHOP_SHIPPING_THRESHOLD_CENTS = 10000; // 100,00 €
const SHOP_SHIPPING_AMOUNT_CENTS = 490;      // 4,90 €

// =====================
// CORS – Firebase Hosting / DEV / local
// =====================
const ALLOWED_ORIGINS = [
  "https://cleanup-manager.fr",
  "https://www.cleanup-manager.fr",
 "https://sofy2831.github.io",
"https://cleanup-manager-d9301.web.app",
  "https://cleanup-manager-d9301.firebaseapp.com",

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
    let path = req.path;
    if (!path) {
      const u = new URL(req.url, "http://localhost");
      path = u.pathname || "/";
    }

    // normalise le préfixe Hosting rewrite /api
    if (path.startsWith("/api/")) {
      path = path.slice(4); // "/api/test" => "/test"
    } else if (path === "/api") {
      path = "/";
    }

    return path || "/";
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

function getShopPriceId(itemId) {
  return SHOP_PRICE_IDS[String(itemId || "").trim()] || null;
}

function getShopItemAmount(itemId) {
  return Number(SHOP_CATALOG[String(itemId || "").trim()]?.unitAmount || 0);
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
// iCal helpers
// =====================
function pad2(n) {
  return n < 10 ? "0" + n : "" + n;
}

function dateKeyFromDate(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function timeFromDate(d) {
  return pad2(d.getHours()) + ":" + pad2(d.getMinutes());
}

function unfoldIcs(text) {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
  const out = [];

  for (const line of lines) {
    if (!line) continue;

    if (/^[ \t]/.test(line) && out.length) {
      out[out.length - 1] += line.slice(1);
    } else {
      out.push(line);
    }
  }

  return out;
}

function parseIcsDate(value) {
  const v = String(value || "").trim();
  if (!v) return null;

  if (/^\d{8}$/.test(v)) {
    const y = Number(v.slice(0, 4));
    const m = Number(v.slice(4, 6)) - 1;
    const d = Number(v.slice(6, 8));
    return new Date(y, m, d, 0, 0, 0, 0);
  }

  const m = v.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const da = Number(m[3]);
  const hh = Number(m[4]);
  const mi = Number(m[5]);
  const ss = Number(m[6]);
  const isUtc = !!m[7];

  if (isUtc) {
    return new Date(Date.UTC(y, mo, da, hh, mi, ss));
  }

  return new Date(y, mo, da, hh, mi, ss);
}

function parseIcs(text) {
  const lines = unfoldIcs(text);
  const events = [];
  let cur = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (cur) events.push(cur);
      cur = null;
      continue;
    }

    if (!cur) continue;

    const idx = line.indexOf(":");
    if (idx === -1) continue;

    const left = line.slice(0, idx);
    const val = line.slice(idx + 1);
    const key = left.split(";")[0].toUpperCase();

    if (key === "UID") cur.uid = val.trim();
    if (key === "SUMMARY") cur.summary = val.trim();
    if (key === "LOCATION") cur.location = val.trim();

    if (key === "DTSTART") {
      cur.dtstartRaw = val.trim();
      cur.start = parseIcsDate(val.trim());
    }

    if (key === "DTEND") {
      cur.dtendRaw = val.trim();
      cur.end = parseIcsDate(val.trim());
    }
  }

  return events.filter((e) => e.start instanceof Date && !isNaN(e.start));
}

function sanitizeId(s) {
  return String(s || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 120);
}

function makeDocId(homeId, icalUid, startKey) {
  return sanitizeId(homeId) + "__" + sanitizeId(icalUid || "no_uid") + "__" + sanitizeId(startKey || "no_date");
}

function isAllDayRaw(raw) {
  return /^\d{8}$/.test(String(raw || "").trim());
}

function addDaysDate(d, n) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function daysBetweenInclusive(fromKey, toKey) {
  const y1 = Number(fromKey.slice(0, 4));
  const m1 = Number(fromKey.slice(5, 7)) - 1;
  const d1 = Number(fromKey.slice(8, 10));
  const y2 = Number(toKey.slice(0, 4));
  const m2 = Number(toKey.slice(5, 7)) - 1;
  const d2 = Number(toKey.slice(8, 10));

  let cur = new Date(y1, m1, d1);
  const end = new Date(y2, m2, d2);
  const out = [];

  while (cur <= end) {
    out.push(dateKeyFromDate(cur));
    cur = addDaysDate(cur, 1);
  }

  return out;
}

async function fetchIcalText(url) {
  let safeUrl = String(url || "").trim();

  if (/^webcal:\/\//i.test(safeUrl)) {
    safeUrl = safeUrl.replace(/^webcal:\/\//i, "https://");
  }

  if (!/^https:\/\//i.test(safeUrl)) {
    throw new Error("Lien iCal invalide");
  }

  const response = await fetch(safeUrl, {
    method: "GET",
    headers: {
      "User-Agent": "CleanUpManager/1.0",
      "Accept": "text/calendar,text/plain,*/*",
    },
  });

  if (!response.ok) {
    throw new Error(`Lecture iCal impossible (HTTP ${response.status})`);
  }

  const text = await response.text();

  if (!text.includes("BEGIN:VCALENDAR")) {
    throw new Error("Le contenu récupéré n'est pas un iCal valide");
  }

  return text;
}
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
// iCal scheduled sync
// =====================
exports.syncIcalScheduled = onSchedule(
  {
    schedule: "every 6 hours",
    timeZone: "Europe/Paris",
    region: "europe-west1",
    timeoutSeconds: 540,
    memory: "1GiB",
    retryCount: 0,
  },
  async () => {
    const db = admin.firestore();

    const homesSnap = await db
      .collection("homes")
      .where("icalSyncEnabled", "==", true)
      .get();

    let homesProcessed = 0;
    let homesOk = 0;
    let homesError = 0;
    let totalWritten = 0;

    for (const homeDoc of homesSnap.docs) {
      homesProcessed++;

      const hd = homeDoc.data() || {};
      const homeId = homeDoc.id;

      const icalUrl = String(hd.icalUrl || "").trim();
      const conciergerieUid = String(hd.conciergerieUid || "").trim();
      const ownerUid = String(hd.ownerUid || "").trim();
      const ownerDocId = String(hd.ownerDocId || "").trim();

      if (!icalUrl || !conciergerieUid || !ownerUid) {
        homesError++;

        await homeDoc.ref.set(
          {
            icalLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
            icalLastSyncStatus: "error",
            icalLastSyncError: "icalUrl ou ownerUid manquant",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        continue;
      }

      try {
        const text = await fetchIcalText(icalUrl);
        const evs = parseIcs(text);

        const seenDocIds = new Set();
        let written = 0;

        for (const e of evs) {
          const startKey = dateKeyFromDate(e.start);
          const arrivalDateKey = startKey;
          const arrivalTime = isAllDayRaw(e.dtstartRaw) ? "16:00" : timeFromDate(e.start);

          let departureDateKey = "";
          let departureTime = "";

          if (e.end instanceof Date && !isNaN(e.end)) {
            if (isAllDayRaw(e.dtendRaw)) {
              departureDateKey = dateKeyFromDate(e.end);
              departureTime = "10:00";
            } else {
              departureDateKey = dateKeyFromDate(e.end);
              departureTime = timeFromDate(e.end);
            }
          }

          const dateKeys =
            departureDateKey && departureDateKey >= arrivalDateKey
              ? daysBetweenInclusive(arrivalDateKey, departureDateKey)
              : [arrivalDateKey];

          const tmForId = arrivalTime || "00:00";
          const uid =
            e.uid ||
            (String(e.summary || "no_summary") + "_" + arrivalDateKey + "_" + tmForId);

          const docId = makeDocId(homeId, uid, arrivalDateKey + "_" + tmForId);
          seenDocIds.add(docId);

          await db.collection("icalEvents").doc(docId).set(
            {
              conciergerieUid,
              ownerUid,
              ownerDocId,

              homeId,
              homeName: String(hd.name || "").trim(),
              homeAddress: String(hd.address || hd.homeAddress || "").trim(),
              homeZip: String(hd.zip || hd.homeZip || "").trim(),
              homeCity: String(hd.city || hd.homeCity || "").trim(),

              dateKey: arrivalDateKey,
              dateKeys,

              arrivalDateKey,
              arrivalTime,
              departureDateKey,
              departureTime,

              summary: String(e.summary || "Réservation").trim(),
              location: String(e.location || "").trim(),
              meta: "",

              source: "ical",
              archived: false,

              icalUid: String(e.uid || "").trim(),
              icalUrl,
              startIso: e.start.toISOString(),
              endIso: (e.end instanceof Date && !isNaN(e.end)) ? e.end.toISOString() : "",

              timezone: "Europe/Paris",
              syncSource: "scheduled",

              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          written++;
        }

        const oldSnap = await db
          .collection("icalEvents")
          .where("homeId", "==", homeId)
          .where("source", "==", "ical")
          .get();

        const batch = db.batch();
        let archivedCount = 0;

        oldSnap.forEach((docSnap) => {
          if (!seenDocIds.has(docSnap.id)) {
            batch.set(
              docSnap.ref,
              {
                archived: true,
                archivedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              },
              { merge: true }
            );
            archivedCount++;
          }
        });

        if (archivedCount > 0) {
          await batch.commit();
        }

        totalWritten += written;
        homesOk++;

        await homeDoc.ref.set(
          {
            icalLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
            icalLastSyncStatus: "ok",
            icalLastSyncError: admin.firestore.FieldValue.delete(),
            icalLastSyncCount: written,
            icalLastArchivedCount: archivedCount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } catch (err) {
        homesError++;

        await homeDoc.ref.set(
          {
            icalLastSyncAt: admin.firestore.FieldValue.serverTimestamp(),
            icalLastSyncStatus: "error",
            icalLastSyncError: String(err?.message || "Erreur inconnue"),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        console.error("syncIcalScheduled home error:", {
          homeId,
          message: err?.message || err,
        });
      }
    }

    await db.collection("systemLogs").add({
      type: "ICAL_SCHEDULED_SYNC",
      homesProcessed,
      homesOk,
      homesError,
      totalWritten,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return null;
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
if (
  method === "GET" &&
  (path === "/" || path === "" || path === "/api" || path === "/api/")
) {
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
    // 2-shop) CREATE SHOP CHECKOUT SESSION
    // =====================
    if (method === "POST" && path === "/create-shop-checkout-session") {
      try {
        const body = ensureJsonBody(req);
        const { items, successUrl, cancelUrl } = body || {};

        if (!Array.isArray(items) || !items.length) {
          return res.status(400).json({ error: "panier vide" });
        }

        const cleanedItems = items
          .map((item) => ({
            id: String(item?.id || "").trim(),
            quantity: Math.floor(Number(item?.quantity || 0)),
          }))
          .filter(
            (item) =>
              item.id &&
              Number.isInteger(item.quantity) &&
              item.quantity > 0 &&
              item.quantity <= 999
          );

        if (!cleanedItems.length) {
          return res.status(400).json({ error: "panier invalide" });
        }

        const line_items = [];
        let subtotalCents = 0;

        for (const item of cleanedItems) {
          const priceId = getShopPriceId(item.id);
          const unitAmount = getShopItemAmount(item.id);

          if (!priceId || !unitAmount) {
            return res.status(400).json({
              error: "article invalide",
              itemId: item.id || null,
              mode: IS_DEV_PROJECT ? "dev" : "prod",
            });
          }

          line_items.push({
            price: priceId,
            quantity: item.quantity,
          });

          subtotalCents += unitAmount * item.quantity;
        }

        const needsShipping = subtotalCents < SHOP_SHIPPING_THRESHOLD_CENTS;

        if (needsShipping) {
          const shippingPriceId = SHOP_PRICE_IDS.shipping;

          if (!shippingPriceId) {
            return res.status(500).json({
              error: "shipping price id manquant",
              mode: IS_DEV_PROJECT ? "dev" : "prod",
            });
          }

          line_items.push({
            price: shippingPriceId,
            quantity: 1,
          });
        }

        const origin =
          req.headers.origin && ALLOWED_ORIGINS.includes(req.headers.origin)
            ? req.headers.origin
            : "https://cleanup-manager.fr";

        const safeSuccessUrl =
          String(successUrl || "").trim() ||
          `${origin}/shop-success.html?session_id={CHECKOUT_SESSION_ID}`;

        const safeCancelUrl =
          String(cancelUrl || "").trim() ||
          `${origin}/shop-cancel.html`;

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items,
          success_url: safeSuccessUrl,
          cancel_url: safeCancelUrl,
          billing_address_collection: "auto",
          payment_method_types: ["card"],
          metadata: {
            source: "cleanup_shop",
            subtotalCents: String(subtotalCents),
            shippingApplied: needsShipping ? "yes" : "no",
          },
        });

        return res.json({
          ok: true,
          url: session.url,
          mode: session.livemode ? "live" : "test",
        });
      } catch (err) {
        console.error("❌ create-shop-checkout-session error:", {
          message: err?.message,
          type: err?.type,
          rawMessage: err?.raw?.message,
          code: err?.code,
          stripeKeyMode: String(stripeKey || "").startsWith("sk_test_")
            ? "test"
            : "live",
          projectId: PROJECT_ID || null,
          isDevProject: IS_DEV_PROJECT,
        });
        return res.status(500).json({ error: "shop checkout session failed" });
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
