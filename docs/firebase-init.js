import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth, setPersistence,
  indexedDBLocalPersistence, browserLocalPersistence,
  browserSessionPersistence, inMemoryPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

import prod from "./firebase-config.prod.js";
import dev from "./firebase-config.dev.js";

// DEV seulement pour toi: basé sur hostname (le plus safe)
const isDevHost =
  location.hostname === "localhost" ||
  location.hostname.startsWith("127.") ||
  location.hostname.startsWith("dev.") ||
  (location.hostname.endsWith(".web.app") && location.hostname.includes("-dev"));

console.info("[env] hostname=", location.hostname, "isDevHost=", isDevHost);

const firebaseConfig = isDevHost ? dev : prod;

if (!firebaseConfig || !firebaseConfig.projectId) {
  throw new Error("[firebase-init] firebaseConfig invalide (dev/prod). Vérifie les exports default.");
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

async function applyBestPersistence() {
  const tries = [
    { name: "indexedDBLocalPersistence", p: indexedDBLocalPersistence },
    { name: "browserLocalPersistence", p: browserLocalPersistence },
    { name: "browserSessionPersistence", p: browserSessionPersistence },
    { name: "inMemoryPersistence", p: inMemoryPersistence },
  ];

  for (const t of tries) {
    try {
      await setPersistence(auth, t.p);
      console.info("[auth] persistence =", t.name);
      return t.name;
    } catch (e) {
      console.warn("[auth] persistence failed:", t.name, e?.code || e?.message || e);
    }
  }
  return "unknown";
}

export const authReady = applyBestPersistence();

