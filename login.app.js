// ============================================================
//  login.app.js  —  one login for all clients (Google Sheets setup).
//  Matches the email to the client's app (from clients.js) and
//  sends them there. No database needed.
//
//  To manage clients, edit clients.js — NOT this file.
// ============================================================
import { auth } from "/firebase-init.js";
import { CLIENT_APP } from "/clients.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = (id) => document.getElementById(id);
function show(type, text){ const m=$("msg"); m.className="msg show "+type; m.textContent=text; }
function clearMsg(){ $("msg").className="msg"; }

function humanError(code){
  const map = {
    "auth/invalid-email":"That email address doesn't look right.",
    "auth/missing-password":"Please enter your password.",
    "auth/invalid-credential":"Email or password is incorrect.",
    "auth/user-not-found":"No account found with that email.",
    "auth/wrong-password":"Email or password is incorrect.",
    "auth/too-many-requests":"Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed":"Network problem. Check your connection and retry."
  };
  return map[code] || "Something went wrong. Please try again.";
}

async function submitForm(){
  clearMsg();
  const email=$("email").value.trim(), password=$("password").value;
  const btn=$("submitBtn");
  if(!email || !password){ show("error","Please enter your email and password."); return; }
  btn.disabled=true; const original=btn.textContent; btn.textContent="Signing in\u2026";
  try{
    await signInWithEmailAndPassword(auth, email, password);
    const app = CLIENT_APP[email.toLowerCase()];
    if(app){
      show("success","Signed in! Opening your workspace\u2026");
      setTimeout(()=>{ location.href = "/" + app + "/"; }, 700);
    } else {
      show("error","Your account isn't linked to an app yet. Please contact your provider.");
      btn.disabled=false; btn.textContent=original;
    }
  }catch(err){
    show("error", humanError(err.code));
    btn.disabled=false; btn.textContent=original;
  }
}

async function resetPassword(){
  const email=$("email").value.trim();
  if(!email){ show("info","Enter your email above, then tap Forgot password again."); return; }
  try{ await sendPasswordResetEmail(auth, email); show("success","Password reset link sent. Check your inbox."); }
  catch(err){ show("error", humanError(err.code)); }
}

$("submitBtn").addEventListener("click", submitForm);
$("forgotBtn").addEventListener("click", resetPassword);
$("password").addEventListener("keydown", (e)=>{ if(e.key==="Enter") submitForm(); });
