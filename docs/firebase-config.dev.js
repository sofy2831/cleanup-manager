// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAdJcYdfawEkzN1djlvAD9IMcSuRMk_1cA",
  authDomain: "cleanup-manager-dev.firebaseapp.com",
  projectId: "cleanup-manager-dev",
  storageBucket: "cleanup-manager-dev.firebasestorage.app",
  messagingSenderId: "429812093176",
  appId: "1:429812093176:web:d3911c8585afa7d2daeb0d",
  measurementId: "G-FFXXW01H6P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
