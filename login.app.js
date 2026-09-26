// ============================================================
//  login.app.js — one login for every client.
//  After sign-in it reads the user's profile from Firestore and
//  sends them to the app named there. Users are managed in the
//  app (admin-users.html), not in this file.
// ============================================================
import { auth } from "/firebase-init.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const db = getFirestore();
const $ = id => document.getElementById(id);
const show = (t, m) => { const x = $("msg"); x.className = "msg show " + t; x.textContent = m; };
const clear = () => { $("msg").className = "msg"; };

function humanError(code){
  return ({
    "auth/invalid-email":"That email address doesn't look right.",
    "auth/missing-password":"Please enter your password.",
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/user-not-found":"No account found with that email.",
    "auth/wrong-password":"Email or password is incorrect.",
    "auth/too-many-requests":"Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed":"Network problem. Check your connection and retry."
  })[code] || "Something went wrong. Please try again.";
}

async function submitForm(){
  clear();
  const email = $("email").value.trim(), password = $("password").value;
  const btn = $("submitBtn");
  if(!email || !password){ show("error","Please enter your email and password."); return; }
  btn.disabled = true; const original = btn.textContent; btn.textContent = "Signing in\u2026";
  try{
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snap = await getDoc(doc(db, "users", cred.user.uid));
    if(!snap.exists()){
      await signOut(auth);
      show("error","Your account isn't set up yet. Please contact your provider.");
      btn.disabled = false; btn.textContent = original; return;
    }
    const p = snap.data();
    if(p.active === false){
      await signOut(auth);
      show("error","This account has been disabled. Please contact your provider.");
      btn.disabled = false; btn.textContent = original; return;
    }
    show("success","Signed in! Opening your workspace\u2026");
    setTimeout(()=>{ location.href = "/" + (p.app || "shoestore2") + "/"; }, 600);
  }catch(err){
    show("error", humanError(err.code));
    btn.disabled = false; btn.textContent = original;
  }
}

async function resetPassword(){
  const email = $("email").value.trim();
  if(!email){ show("info","Enter your email above, then tap Forgot password again."); return; }
  try{ await sendPasswordResetEmail(auth, email); show("success","Password reset link sent. Check your inbox."); }
  catch(err){ show("error", humanError(err.code)); }
}

$("submitBtn").addEventListener("click", submitForm);
$("forgotBtn").addEventListener("click", resetPassword);
$("password").addEventListener("keydown", e => { if(e.key === "Enter") submitForm(); });
