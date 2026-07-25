const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

console.log("--------------------------------------------------");

const envPath = path.join(__dirname, ".env");
const token = crypto.randomBytes(32).toString("hex");

console.log("--------------------------------------------------");
console.log("🔑 WhatsApp Gateway API Token Generator");
console.log("--------------------------------------------------");

let envContent = "";
if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, "utf8");
}

const tokenLine = `WHATSAPP_API_TOKEN=${token}`;

if (envContent.includes("WHATSAPP_API_TOKEN=")) {
  // Replace existing token line
  envContent = envContent.replace(/WHATSAPP_API_TOKEN=.*/g, tokenLine);
  console.log("🔄 Existing API token updated in .env");
} else {
  // Append new token line
  envContent += (envContent.endsWith("\n") ? "" : "\n") + tokenLine + "\n";
  console.log("➕ New API token appended to .env");
}

fs.writeFileSync(envPath, envContent, "utf8");

console.log(`\n🎉 Success! Your API Token is:`);
console.log(`👉 ${token}`);
console.log(`\nKeep this token secure! Use it as a Bearer token or pass it as a parameter.`);
console.log("--------------------------------------------------");
