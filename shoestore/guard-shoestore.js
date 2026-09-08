// Firebase gate for the shoe app.
// If the visitor isn't a logged-in shoestore client, they're bounced to login.
// If they are, we remember their name so the app can attribute stock changes.
import { guard } from "/auth-guard.js";
 
guard("shoestore", function (user, info) {
  window.__IMS_USER = info.name;   // e.g. their business name or email
});
 
