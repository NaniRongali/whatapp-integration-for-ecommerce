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
  console.log(
    "Usage: node test-broadcast.js <phone_number_1> <phone_number_2> ... <phone_number_N>",
  );
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
          Authorization: `Bearer ${API_TOKEN}`,
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
      },
    );

    req.on("error", (e) => reject(e));
    req.write(payload);
    req.end();
  });
}

function getStatus() {
  return new Promise((resolve, reject) => {
    http
      .get(
        `http://localhost:3001/status?token=${API_TOKEN}&session=${SESSION_ID}`,
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            try {
              resolve(JSON.parse(body || "{}"));
            } catch (e) {
              resolve({});
            }
          });
        },
      )
      .on("error", (e) => reject(e));
  });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runBroadcast() {
  console.log(
    `Starting broadcast test for recipients: ${RECIPIENTS.join(", ")}`,
  );

  const promises = RECIPIENTS.map((phone, i) => {
    return (async () => {
      console.log(`Dispatching request to recipient ${i + 1}/${RECIPIENTS.length}: ${phone}`);
      try {
        const response = await postJSON({
          to: phone,
          message:
            "Hello! This is a Sriram sending multi-recipient broadcast test verifying the server logs.",
        });
        console.log(
          `Client response for ${phone}: Status ${response.statusCode}`,
          response.body,
        );
      } catch (e) {
        console.error(`Client request failed for ${phone}:`, e.message);
      }
    })();
  });

  await Promise.all(promises);

  console.log("\n--------------------------------------------------");
  console.log("📨 All broadcast messages enqueued on the server!");
  console.log("--------------------------------------------------");
  console.log("Waiting for the server queue to finish delivering...");

  let remaining = 99;
  while (remaining > 0) {
    try {
      const status = await getStatus();
      remaining = status.queueLength !== undefined ? status.queueLength : 0;
      if (remaining > 0) {
        console.log(
          `[Queue Progress] Pending messages remaining in queue: ${remaining}`,
        );
        await sleep(2500);
      }
    } catch (err) {
      console.error("Failed to poll status:", err.message);
      break;
    }
  }

  console.log(
    "\nBroadcast test complete and all messages successfully delivered!",
  );
}

runBroadcast();
