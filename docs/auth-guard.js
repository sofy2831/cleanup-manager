import { auth, authReady } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

export async function requireAuth(redirectUrl){
  await authReady;

  return new Promise((resolve)=>{
    onAuthStateChanged(auth, (user)=>{
      if(!user){
        location.replace(redirectUrl || "login.html");
        resolve(null);
      }else{
        resolve(user);
      }
    });
  });
}
