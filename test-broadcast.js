const http = require("http");
const fs = require("fs");
const path = require("path");

// Load local token from .env
const envPath = path.join(__dirname, ".env");
let API_TOKEN = "";
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/WHATSAPP_API_TOKEN=(.*)/);
  if (match) {
    API_TOKEN = match[1].trim();
  }
}

const RECIPIENTS = process.argv.slice(2);
if (RECIPIENTS.length === 0) {
  console.log("Usage: node test-broadcast.js <phone_number_1> <phone_number_2> ... <phone_number_N>");
  console.log("Example: node test-broadcast.js 919876543210 919999988888\n");
  process.exit(0);
}
const SESSION_ID = process.env.SESSION || "default";

function postJSON(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ session: SESSION_ID, ...data });
    const req = http.request(
      `http://localhost:3001/`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_TOKEN}`,
          "Content-Length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed = body;
          try {
            parsed = JSON.parse(body || "{}");
          } catch (e) {}
          resolve({ statusCode: res.statusCode, body: parsed });
        });
      }
    );

    req.on("error", (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBroadcast() {
  console.log(`Starting broadcast test for recipients: ${RECIPIENTS.join(", ")}`);
  for (let i = 0; i < RECIPIENTS.length; i++) {
    const phone = RECIPIENTS[i];
    console.log(`\nDispatching request to recipient ${i + 1}/${RECIPIENTS.length}: ${phone}`);
    try {
      const response = await postJSON({
        to: phone,
        message: "Hello! This is a multi-recipient broadcast test verifying the server logs."
      });
      console.log(`Client response: Status ${response.statusCode}`, response.body);
    } catch (e) {
      console.error(`Client request failed:`, e.message);
    }
    
    if (i < RECIPIENTS.length - 1) {
      console.log("Waiting 2.5 seconds before next dispatch...");
      await sleep(2500);
    }
  }
  console.log("\nBroadcast test complete.");
}

runBroadcast();
