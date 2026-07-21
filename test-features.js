const http = require("http");
const fs = require("fs");
const path = require("path");

// Load local token
const envPath = path.join(__dirname, ".env");
let API_TOKEN = "";
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/WHATSAPP_API_TOKEN=(.*)/);
  if (match) {
    API_TOKEN = match[1].trim();
  }
}

console.log("Testing gateway features with token:", API_TOKEN);

function postJSON(urlPath, data, headers = {}) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(data);
    const req = http.request(
      `http://localhost:3001${urlPath}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_TOKEN}`,
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
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

    req.on("error", (e) => {
      resolve({ error: e.message });
    });

    req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log("\n--------------------------------------------------");
  console.log("🚦 STARTING GATEWAY FEATURE TESTING");
  console.log("--------------------------------------------------");

  // Test 1: Empty payload should return 400
  console.log("\nTest 1: POST / with empty payload (expect 400)...");
  const t1 = await postJSON("/", {});
  console.log("Status:", t1.statusCode, "Body:", t1.body);
  if (t1.statusCode === 400 && t1.body.error && t1.body.error.includes("phone")) {
    console.log("✅ Passed: Rejected missing phone.");
  } else {
    console.log("❌ Failed Test 1");
  }

  // Test 2: Valid phone but missing content should return 400
  console.log("\nTest 2: POST / with phone but missing message/attachment/location/etc (expect 400)...");
  const t2 = await postJSON("/", { to: "9876543210" });
  console.log("Status:", t2.statusCode, "Body:", t2.body);
  if (t2.statusCode === 400 && t2.body.error && t2.body.error.includes("content")) {
    console.log("✅ Passed: Rejected empty content payload.");
  } else {
    console.log("❌ Failed Test 2");
  }

  // Test 3: Invalid phone number format (too short) should return 400
  console.log("\nTest 3: POST / with too short phone number (expect 400)...");
  const t3 = await postJSON("/", { to: "123", message: "Hello" });
  console.log("Status:", t3.statusCode, "Body:", t3.body);
  if (t3.statusCode === 400 && t3.body.error && t3.body.error.includes("Invalid phone number format")) {
    console.log("✅ Passed: Correctly validated number length.");
  } else {
    console.log("❌ Failed Test 3");
  }

  // Test 4: Invalid location (missing longitude) should return 400
  console.log("\nTest 4: POST / with invalid location fields (expect 400)...");
  const t4 = await postJSON("/", { to: "9876543210", location: { latitude: 12.97 } });
  console.log("Status:", t4.statusCode, "Body:", t4.body);
  if (t4.statusCode === 400 && t4.body.error && t4.body.error.includes("longitude")) {
    console.log("✅ Passed: Checked for required location fields.");
  } else {
    console.log("❌ Failed Test 4");
  }

  // Test 5: Invalid contact (missing phone) should return 400
  console.log("\nTest 5: POST / with invalid contact fields (expect 400)...");
  const t5 = await postJSON("/", { to: "9876543210", contact: { fullName: "Jane Doe" } });
  console.log("Status:", t5.statusCode, "Body:", t5.body);
  if (t5.statusCode === 400 && t5.body.error && t5.body.error.includes("phone")) {
    console.log("✅ Passed: Checked for required contact fields.");
  } else {
    console.log("❌ Failed Test 5");
  }

  console.log("\nNote: Valid payloads will return 503 if WhatsApp is not connected, or 200 if connected.");
  console.log("Let's try a valid text request with countryCode option:");
  const t6 = await postJSON("/", { to: "5551234567", countryCode: "1", message: "Test message" });
  console.log("Status:", t6.statusCode, "Body:", t6.body);
  if (t6.statusCode === 200 || t6.statusCode === 503) {
    console.log("✅ Passed: Got past local validations!");
  } else {
    console.log("❌ Failed Test 6");
  }

  console.log("\nLet's try a valid location payload request:");
  const t7 = await postJSON("/", {
    to: "9876543210",
    location: { latitude: 12.9716, longitude: 77.5946, name: "Office", address: "City Center" },
  });
  console.log("Status:", t7.statusCode, "Body:", t7.body);
  if (t7.statusCode === 200 || t7.statusCode === 503) {
    console.log("✅ Passed: Got past local validations!");
  } else {
    console.log("❌ Failed Test 7");
  }

  console.log("\nLet's try a valid contact card payload request:");
  const t8 = await postJSON("/", {
    to: "9876543210",
    contact: { fullName: "Jeff Bezos", organization: "Amazon", phone: "+12062661000" },
  });
  console.log("Status:", t8.statusCode, "Body:", t8.body);
  if (t8.statusCode === 200 || t8.statusCode === 503) {
    console.log("✅ Passed: Got past local validations!");
  } else {
    console.log("❌ Failed Test 8");
  }
}

runTests();
