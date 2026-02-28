// docs/auth-guard.js (STABLE — iOS-friendly, no double redirect loops)
import { auth, db, authReady } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

function normRole(s){
  return String(s || "").toLowerCase().trim();
}

function withRoleParam(url, role){
  try{
    if(!url) return url;
    const u = new URL(url, location.href);
    if(role) u.searchParams.set("role", role);
    return u.pathname + u.search + u.hash;
  }catch{
    // url relative pas parseable -> fallback simple
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
      // ⚠️ iOS: parfois un callback "null" arrive avant que la session ne soit restaurée.
      // On laisse une mini fenêtre pour recevoir un second callback non-null.
      if(done) return;

      if(user){
        done = true;
        clearTimeout(timer);
        unsub();
        resolve({ user, reason: "ok" });
        return;
      }

      // Si null -> on attend un petit tick (micro window) avant de conclure.
      // (Sinon tu unsub trop vite et tu perds la réhydratation)
      setTimeout(() => {
        if(done) return;
        // si toujours null après cette fenêtre, on conclut null.
        done = true;
        clearTimeout(timer);
        try{ unsub(); }catch(_){}
        resolve({ user: null, reason: "null" });
      }, 250);
    });
  });
}

export async function loadIdentity(uid){
  try{
    const snap = await getDoc(doc(db, "identities", uid));
    return snap.exists() ? (snap.data() || null) : null;
  }catch(e){
    console.warn("[loadIdentity]", e?.code || "", e?.message || e);
    return null;
  }
}

/**
 * requireAuth
 * -> retourne { user } ou null (redirige)
 */
export async function requireAuth(redirectUrl = "login.html"){
  const { user } = await getCurrentUserOnce();
  if(!user){
    location.replace(redirectUrl);
    return null;
  }
  return { user };
}

/**
 * requireRole
 * -> retourne { user, role, identity } ou null (redirige)
 * allowedRoles = ["conciergerie","admin","staff"] etc.
 */
export async function requireRole(allowedRoles = [], redirectUrl = "login.html", options = {}){
  const roleParam = options?.roleParam || null; // ex: "conciergerie" pour login.html?role=conciergerie
  const targetUrl = roleParam ? withRoleParam(redirectUrl, roleParam) : redirectUrl;

  const { user } = await getCurrentUserOnce(options);
  if(!user){
    location.replace(targetUrl);
    return null;
  }

  const identity = await loadIdentity(user.uid);
  const role = normRole(identity?.role);

  const allowed = (allowedRoles || []).map(normRole);
  if(!role || (allowed.length && !allowed.includes(role))){
    location.replace(targetUrl);
    return null;
  }

  return { user, role, identity };
}
