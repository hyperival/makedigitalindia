import { guard, logout } from "/auth-guard.js";
 
guard("legal", (user, info) => {
  document.getElementById("userName").textContent = info.name;
  document.getElementById("greetName").textContent = user.displayName || "there";
  document.getElementById("loader").style.display = "none";
  document.getElementById("app").hidden = false;
});
 
document.getElementById("logoutBtn").addEventListener("click", logout);
 
