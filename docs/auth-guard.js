// docs/auth-guard.js (FINAL — users.role only, iOS-friendly, no double redirect loops)
import { auth, db, authReady } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function normRole(s){
  return String(s || "").toLowerCase().trim();
}

function normEmail(s){
  return String(s || "").trim().toLowerCase();
}

function withRoleParam(url, role){
  try{
    if(!url) return url;
    const u = new URL(url, location.href);
    if(role) u.searchParams.set("role", role);
    return u.pathname + u.search + u.hash;
  }catch{
    if(role && !String(url).includes("role=")){
      return url + (url.includes("?") ? "&" : "?") + "role=" + encodeURIComponent(role);
    }
    return url;
  }
}

async function getCurrentUserOnce({ timeoutMs = 3500 } = {}){
  await authReady;

  return new Promise((resolve) => {
    let done = false;

    const timer = setTimeout(() => {
      if(done) return;
      done = true;
      try{ unsub(); }catch(_){}
      resolve({ user: null, reason: "timeout" });
    }, timeoutMs);

    const unsub = onAuthStateChanged(auth, (user) => {
      if(done) return;

      if(user){
        done = true;
        clearTimeout(timer);
        try{ unsub(); }catch(_){}
        resolve({ user, reason: "ok" });
        return;
      }

      // iOS sometimes emits null before session rehydrates
      setTimeout(() => {
        if(done) return;
        done = true;
        clearTimeout(timer);
        try{ unsub(); }catch(_){}
        resolve({ user: null, reason: "null" });
      }, 250);
    });
  });
}

// === DEV allowlist (must match rules if you use it there too)
const DEV_ALLOWLIST = new Set([
  "s.dumas974@gmail.com",
  "mathildeconciergerie45@gmail.com",
]);

function isAllowlistedEmail(user){
  const email = normEmail(user?.email || "");
  return email && DEV_ALLOWLIST.has(email);
}

async function loadUserDoc(uid){
  try{
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() || null) : null;
  }catch(e){
    console.warn("[loadUserDoc]", e?.code || "", e?.message || e);
    return null;
  }
}

function roleFromUrlParam(){
  const r = normRole(new URLSearchParams(location.search).get("role") || "");
  // only accept known roles to avoid garbage
  if(r === "conciergerie" || r === "proprietaire" || r === "admin" || r === "staff") return r;
  return "";
}

/**
 * requireAuth
 * -> returns { user } or null (redirects)
 */
export async function requireAuth(redirectUrl = "login.html", options = {}){
  const { user } = await getCurrentUserOnce(options);
  if(!user){
    location.replace(redirectUrl);
    return null;
  }
  return { user };
}

/**
 * requireRole
 * -> returns { user, role, userDoc, allowlisted } or null (redirects)
 * allowedRoles = ["conciergerie","admin","staff"] etc.
 */
export async function requireRole(allowedRoles = [], redirectUrl = "login.html", options = {}){
  const roleParam = options?.roleParam || null;
  const targetUrl = roleParam ? withRoleParam(redirectUrl, roleParam) : redirectUrl;

  const { user } = await getCurrentUserOnce(options);
  if(!user){
    location.replace(targetUrl);
    return null;
  }

  const allowlisted = isAllowlistedEmail(user);

  // Source of truth = users/{uid}.role
  const userDoc = await loadUserDoc(user.uid);

  // role resolution strategy:
  // 1) users.role
  // 2) if allowlisted: allow a fallback from URL role param
  // 3) fallback: empty => treated as not allowed
  let role = normRole(userDoc?.role || "");
  if(!role && allowlisted){
    role = roleFromUrlParam(); // allows dev to enter with login.html?role=conciergerie etc.
  }

  const allowed = (allowedRoles || []).map(normRole);

  // if no allowedRoles provided => any authenticated user is ok
  const ok = !allowed.length || (role && allowed.includes(role));

  if(!ok){
    location.replace(targetUrl);
    return null;
  }

  return { user, role, userDoc, allowlisted };
}
