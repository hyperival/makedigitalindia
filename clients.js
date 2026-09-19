// ============================================================
export const CLIENT_APP = {
  "sanjaygautam779@gmail.com": "shoestore",    // your main account -> old app
  "hdgindia.hr@gmail.com": "shoestore2",   // test account -> new Firebase app
  "office@lawfirm.com":        "legal" ,
"sanjayhdg07@gmail.com":        "shoestore2" 
  // placeholder, change when you onboard them
};
 
// Apps that share the same Firestore data as "shoestore".
// This lets shoestore2 users pass the guard while keeping one clientId.
export const SAME_DATA = {
  shoestore2: "shoestore"
};
 
