// docs/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2qR9FBOobUaCI-Zxrv__pbkIx1IY1QIo",
  authDomain: "cleanup-manager-d9301.firebaseapp.com",
  projectId: "cleanup-manager-d9301",
  storageBucket: "cleanup-manager-d9301.firebasestorage.app",
  messagingSenderId: "616451512758",
  appId: "1:616451512758:web:9252d85102030092664917"
};

export const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ✅ IMPORTANT: on exporte une promesse à await dans chaque page
export const authReady = setPersistence(auth, browserLocalPersistence)
  .catch((e) => {
    console.warn("Auth persistence NON appliquée (session volatile) :", e?.code || e);
    // on ne throw pas : on laisse l'app tourner, mais tu verras le warning
  });
