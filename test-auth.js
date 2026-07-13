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

console.log("Testing with token:", API_TOKEN);

function makeRequest(url, headers = {}) {
  return new Promise((resolve) => {
    http.get(url, { headers }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => {
        let parsed = body;
        try {
          parsed = JSON.parse(body || "{}");
        } catch (e) {}
        resolve({ statusCode: res.statusCode, body: parsed });
      });
    }).on("error", (e) => {
      resolve({ error: e.message });
    });
  });
}

async function runTests() {
  console.log("\n1. Testing GET / status WITHOUT token:");
  const test1 = await makeRequest("http://localhost:3001/");
  console.log("Status Code:", test1.statusCode);
  console.log("Body:", test1.body);

  if (test1.statusCode === 401) {
    console.log("✅ Correctly rejected with 401!");
  } else {
    console.log("❌ Expected 401 but got:", test1.statusCode);
  }

  console.log("\n2. Testing GET / status WITH query param token:");
  const test2 = await makeRequest(`http://localhost:3001/?token=${API_TOKEN}`);
  console.log("Status Code:", test2.statusCode);
  console.log("Body:", test2.body);

  if (test2.statusCode === 200 || test2.statusCode === 503) { // 503 is returned if WhatsApp client is not linked, which is also fine (it means we got past auth!)
    console.log("✅ Correctly authenticated!");
  } else {
    console.log("❌ Failed to authenticate:", test2.statusCode);
  }

  console.log("\n3. Testing GET / status WITH Authorization Bearer header:");
  const test3 = await makeRequest("http://localhost:3001/", {
    "Authorization": `Bearer ${API_TOKEN}`
  });
  console.log("Status Code:", test3.statusCode);
  console.log("Body:", test3.body);

  if (test3.statusCode === 200 || test3.statusCode === 503) {
    console.log("✅ Correctly authenticated via header!");
  } else {
    console.log("❌ Failed to authenticate via header:", test3.statusCode);
  }
}

runTests();
