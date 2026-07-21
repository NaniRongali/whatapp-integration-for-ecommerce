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

  // Test 9: Invalid presence type should return 400
  console.log("\nTest 9: POST / with invalid presence type (expect 400)...");
  const t9 = await postJSON("/", { to: "9876543210", presence: "dancing" });
  console.log("Status:", t9.statusCode, "Body:", t9.body);
  if (t9.statusCode === 400 && t9.body.error && t9.body.error.includes("presence")) {
    console.log("✅ Passed: Correctly verified presence types.");
  } else {
    console.log("❌ Failed Test 9");
  }

  // Test 10: Invalid reaction (missing emoji) should return 400
  console.log("\nTest 10: POST / with invalid reaction payload (expect 400)...");
  const t10 = await postJSON("/", { to: "9876543210", reaction: { messageId: "12345" } });
  console.log("Status:", t10.statusCode, "Body:", t10.body);
  if (t10.statusCode === 400 && t10.body.error && t10.body.error.includes("Reaction must include")) {
    console.log("✅ Passed: Correctly verified reaction fields.");
  } else {
    console.log("❌ Failed Test 10");
  }

  // Test 11: Invalid poll (too few options) should return 400
  console.log("\nTest 11: POST / with invalid poll payload (expect 400)...");
  const t11 = await postJSON("/", { to: "9876543210", poll: { name: "Who?", options: ["Only One"] } });
  console.log("Status:", t11.statusCode, "Body:", t11.body);
  if (t11.statusCode === 400 && t11.body.error && t11.body.error.includes("Poll must include")) {
    console.log("✅ Passed: Correctly verified poll options count.");
  } else {
    console.log("❌ Failed Test 11");
  }

  // Test 12: Invalid contactsList (missing phone) should return 400
  console.log("\nTest 12: POST / with invalid contactsList (expect 400)...");
  const t12 = await postJSON("/", {
    to: "9876543210",
    contactsList: [{ fullName: "John Doe" }],
  });
  console.log("Status:", t12.statusCode, "Body:", t12.body);
  if (t12.statusCode === 400 && t12.body.error && t12.body.error.includes("contactsList must contain both")) {
    console.log("✅ Passed: Correctly verified contactsList item fields.");
  } else {
    console.log("❌ Failed Test 12");
  }

  // Test 13: Valid Poll Payload (expect 200 or 503)
  console.log("\nTest 13: POST / with valid poll payload...");
  const t13 = await postJSON("/", {
    to: "9876543210",
    poll: { name: "Do you like JS?", options: ["Yes", "Absolutely!"], selectableCount: 1 },
  });
  console.log("Status:", t13.statusCode, "Body:", t13.body);
  if (t13.statusCode === 200 || t13.statusCode === 503) {
    console.log("✅ Passed: Got past local validations!");
  } else {
    console.log("❌ Failed Test 13");
  }

  // Test 14: Valid Reaction Payload (expect 200 or 503)
  console.log("\nTest 14: POST / with valid reaction payload...");
  const t14 = await postJSON("/", {
    to: "9876543210",
    reaction: { emoji: "🔥", messageId: "BAE5XXXXXX" },
  });
  console.log("Status:", t14.statusCode, "Body:", t14.body);
  if (t14.statusCode === 200 || t14.statusCode === 503) {
    console.log("✅ Passed: Got past local validations!");
  } else {
    console.log("❌ Failed Test 14");
  }

  // Test 15: Valid Presence Payload (expect 200 or 503)
  console.log("\nTest 15: POST / with valid presence payload...");
  const t15 = await postJSON("/", {
    to: "9876543210",
    presence: "composing",
  });
  console.log("Status:", t15.statusCode, "Body:", t15.body);
  if (t15.statusCode === 200 || t15.statusCode === 503) {
    console.log("✅ Passed: Got past local validations!");
  } else {
    console.log("❌ Failed Test 15");
  }

  // Test 16: Valid Quoted & Mentions Payload (expect 200 or 503)
  console.log("\nTest 16: POST / with valid text message including mentions & quoted options...");
  const t16 = await postJSON("/", {
    to: "9876543210",
    message: "Hey @15551234567 look at this reply!",
    mentions: ["15551234567"],
    quotedMessageId: "ABC54321",
    quotedMessageText: "Original text message",
  });
  console.log("Status:", t16.statusCode, "Body:", t16.body);
  if (t16.statusCode === 200 || t16.statusCode === 503) {
    console.log("✅ Passed: Got past local validations!");
  } else {
    console.log("❌ Failed Test 16");
  }
}

runTests();
