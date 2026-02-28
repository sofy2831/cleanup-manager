// docs/auth-guard.js
import { auth, db, authReady } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

async function getCurrentUserOnce(){
  await authReady;
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user || null);
    });
  });
}

export async function requireAuth(redirectUrl = "login.html"){
  const user = await getCurrentUserOnce();
  if(!user){
    location.replace(redirectUrl);
    return null;
  }
  return user;
}

export async function loadIdentity(uid){
  try{
    const snap = await getDoc(doc(db, "identities", uid));
    return snap.exists() ? (snap.data() || null) : null;
  }catch(e){
    console.warn("[loadIdentity]", e?.code, e?.message);
    return null;
  }
}

export async function requireRole(allowedRoles, redirectUrl){
  const user = await requireAuth(redirectUrl);
  if(!user) return null;

  const ident = await loadIdentity(user.uid);
  const role = String(ident?.role || "").toLowerCase().trim();

  if(!role || !allowedRoles.map(r=>r.toLowerCase()).includes(role)){
    // pas de boucle : on renvoie vers login avec role=...
    location.replace(redirectUrl || "login.html");
    return null;
  }

  return user;
}
