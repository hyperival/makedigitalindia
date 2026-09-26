// ============================================================
//  auth-guard.js — protects each client app.
//  Access now comes from the user's Firestore profile, not a file.
// ============================================================
import { auth, db } from "/firebase-init.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function guard(requiredApp, onReady){
  onAuthStateChanged(auth, async (user) => {
    if(!user){ location.replace('/login.html'); return; }
    let p = null;
    try{ const s = await getDoc(doc(db,'users',user.uid)); if(s.exists()) p = s.data(); }catch(e){}
    if(!p || p.active === false){
      await signOut(auth); location.replace('/login.html?error=noaccess'); return;
    }
    const mine = p.app || 'shoestore2';
    if(requiredApp && mine !== requiredApp){ location.replace('/' + mine + '/'); return; }
    onReady(user, { app: mine, role: p.role || 'staff', clientId: p.clientId,
                    name: p.businessName || user.displayName || user.email });
  });
}

export async function logout(){ await signOut(auth); location.replace('/login.html'); }
