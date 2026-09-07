// ============================================================
//  firebase-init.js  —  Make Digital India
//  Handles LOGIN only (your data lives in Google Sheets for now).
//  These keys are public by design — safe to commit.
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
 
const firebaseConfig = {
  apiKey:            "AIzaSyB-WPSe1SoIEC4JwednqMydhj_cvGgOOs8",
  authDomain:        "make-digital-india-479fb.firebaseapp.com",
  projectId:         "make-digital-india-479fb",
  storageBucket:     "make-digital-india-479fb.firebasestorage.app",
  messagingSenderId: "356753740738",
  appId:             "1:356753740738:web:71e098ed9d21ca911afc5b"
};
 
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
 
