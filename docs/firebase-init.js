import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2qR9FBOobUaCI-Zxrv__pbkIx1IY1QIo",
  authDomain: "cleanup-manager-d9301.firebaseapp.com",
  projectId: "cleanup-manager-d9301",
  storageBucket: "cleanup-manager-d9301.appspot.com",
  messagingSenderId: "616451512758",
  appId: "1:616451512758:web:9252d85102030092664917"
  // measurementId inutile ici
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);


