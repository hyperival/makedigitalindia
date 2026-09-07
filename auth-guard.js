// ============================================================
//  auth-guard.js  —  protects each client app (Google Sheets setup).
//
//  guard(requiredApp, onReady):
//    - not logged in           -> sent to /login.html
//    - email not in clients.js  -> signed out, sent to /login.html
//    - logged in, wrong app     -> sent to THEIR app (/<app>/)
//    - logged in, correct app   -> onReady(user, info) runs
//
//  logout(): signs out and returns to the login page.
// ============================================================
import { auth } from "/firebase-init.js";
import { CLIENT_APP } from "/clients.js";
import { onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export function guard(requiredApp, onReady){
  onAuthStateChanged(auth, (user) => {
    if(!user){ location.replace("/login.html"); return; }
    const app = CLIENT_APP[(user.email || "").toLowerCase()];
    if(!app){
      signOut(auth).then(function(){ location.replace("/login.html?error=noaccess"); });
      return;
    }
    if(requiredApp && app !== requiredApp){
      location.replace("/" + app + "/");   // logged in, but not their app
      return;
    }
    onReady(user, { app: app, name: user.displayName || user.email });
  });
}

export async function logout(){
  await signOut(auth);
  location.replace("/login.html");
}
