// docs/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2qR9FBOobUaCI-Zxrv__pbkIx1IY1QIo",
  authDomain: "cleanup-manager-d9301.firebaseapp.com",
  projectId: "cleanup-manager-d9301",
  storageBucket: "cleanup-manager-d9301.firebasestorage.app",
  messagingSenderId: "616451512758",
  appId: "1:616451512758:web:9252d85102030092664917",
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Persistance AUTH robuste (iOS private / webviews / cookies strict)
// Ordre : IndexedDB (meilleur) -> LocalStorage -> Session -> Memory
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

// ✅ IMPORTANT: on exporte une promesse à await dans chaque page
export const authReady = applyBestPersistence();
