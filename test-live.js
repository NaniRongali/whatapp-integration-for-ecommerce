const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

function fetchBase64(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch raw file: ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve(Buffer.concat(chunks).toString("base64"));
      });
    }).on("error", (err) => reject(err));
  });
}

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

const TARGET_PHONE = process.argv[2] || "919876543210";
console.log(`Using target phone: ${TARGET_PHONE}`);
console.log(`Note: You can override this target phone number by running: node test-live.js <phone_number> (e.g. node test-live.js 919876543210)\n`);

// Helper function to make HTTP POST requests
function postJSON(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
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

async function executeLiveTest() {
  console.log("--------------------------------------------------");
  console.log(`🚀 STARTING COMPREHENSIVE LIVE TEST TO RECIPIENT: ${TARGET_PHONE}`);
  console.log("--------------------------------------------------");

  try {
    // 1. Send Presence Composing (Typing)
    console.log("\n[1/16] Sending typing presence indicator...");
    const r1 = await postJSON({ to: TARGET_PHONE, presence: "composing" });
    console.log("Status:", r1.statusCode, "Response:", r1.body);
    await sleep(2000);

    // 2. Send Text Message
    console.log("\n[2/16] Sending standard text message...");
    const r2 = await postJSON({ 
      to: TARGET_PHONE, 
      message: "Hello! This is the Swift Project comprehensive test verifying both direct URLs & Base64 workflows." 
    });
    console.log("Status:", r2.statusCode, "Response:", r2.body);
    await sleep(2500);

    // 3. Send Quoted Reply
    console.log("\n[3/16] Sending quoted reply message...");
    const r3 = await postJSON({
      to: TARGET_PHONE,
      message: "This is a replies test quoting a dummy message ID.",
      quotedMessageId: "SWIFT_DUMMY_12345",
      quotedMessageText: "Original System Message Preview Text",
      quotedFromMe: false
    });
    console.log("Status:", r3.statusCode, "Response:", r3.body);
    await sleep(2500);

    // 4. Send Group Mention Payload (Simulated text)
    console.log("\n[4/16] Sending tag/mentions payload text...");
    const r4 = await postJSON({
      to: TARGET_PHONE,
      message: "Hey @919876543210 (simulated mention tag link verification)",
      mentions: ["919876543210"]
    });
    console.log("Status:", r4.statusCode, "Response:", r4.body);
    await sleep(2500);

    // 5. Send Location Pin
    console.log("\n[5/16] Sending location pin...");
    const r5 = await postJSON({
      to: TARGET_PHONE,
      location: {
        latitude: 12.9716,
        longitude: 77.5946,
        name: "Gateway Headquarters",
        address: "Swift Tech Park, Sector 5, Bangalore, India"
      }
    });
    console.log("Status:", r5.statusCode, "Response:", r5.body);
    await sleep(2500);

    // 6. Send Single Contact Card
    console.log("\n[6/16] Sending single contact card (Jane Doe)...");
    const r6 = await postJSON({
      to: TARGET_PHONE,
      contact: {
        fullName: "Swift Support Team",
        organization: "Swift Project",
        phone: "+91 98765 43210"
      }
    });
    console.log("Status:", r6.statusCode, "Response:", r6.body);
    await sleep(2500);

    // 7. Send Multiple Contact Cards
    console.log("\n[7/16] Sending multiple contact cards (Support Directory)...");
    const r7 = await postJSON({
      to: TARGET_PHONE,
      contactsDisplayName: "Swift Team Directory",
      contactsList: [
        { fullName: "Alice Developer", organization: "Swift Core Team", phone: "+1 555-123-4567" },
        { fullName: "Bob Manager", organization: "Swift Operations", phone: "+91 98765 43210" }
      ]
    });
    console.log("Status:", r7.statusCode, "Response:", r7.body);
    await sleep(2500);

    // 8. Send WebP Sticker via Direct URL
    console.log("\n[8/16] Sending WebP sticker via direct URL...");
    const r8 = await postJSON({
      to: TARGET_PHONE,
      sticker: "https://raw.githubusercontent.com/WhatsApp/stickers/master/Android/app/src/main/assets/1/01_Cuppy_smile.webp"
    });
    console.log("Status:", r8.statusCode, "Response:", r8.body);
    await sleep(2500);

    // 9. Send Image Attachment via Direct URL
    console.log("\n[9/16] Sending image attachment via direct URL...");
    const r9 = await postJSON({
      to: TARGET_PHONE,
      message: "Direct URL image attachment test!",
      attachment: {
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-images/grapefruit-slice-332-332.jpg",
        fileName: "grapefruit.jpg",
        contentType: "image/jpeg"
      }
    });
    console.log("Status:", r9.statusCode, "Response:", r9.body);
    await sleep(2500);

    // 10. Send Video Attachment via Direct URL
    console.log("\n[10/16] Sending video attachment via direct URL...");
    const r10 = await postJSON({
      to: TARGET_PHONE,
      message: "Direct URL video attachment test!",
      attachment: {
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        fileName: "big-buck-bunny.mp4",
        contentType: "video/mp4"
      }
    });
    console.log("Status:", r10.statusCode, "Response:", r10.body);
    await sleep(2500);

    // 11. Send PDF Document Attachment via Direct URL
    console.log("\n[11/16] Sending PDF document via direct URL...");
    const r11 = await postJSON({
      to: TARGET_PHONE,
      message: "Direct URL PDF document test.",
      attachment: {
        url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        fileName: "monthly-report.pdf",
        contentType: "application/pdf"
      }
    });
    console.log("Status:", r11.statusCode, "Response:", r11.body);
    await sleep(2500);

    // 12. Send Audio note via Direct URL
    console.log("\n[12/16] Sending audio note via direct URL...");
    const r12 = await postJSON({
      to: TARGET_PHONE,
      attachment: {
        url: "https://www.w3schools.com/html/horse.mp3",
        fileName: "horse-neigh.mp3",
        contentType: "audio/mpeg"
      }
    });
    console.log("Status:", r12.statusCode, "Response:", r12.body);
    await sleep(2500);

    // 13. Send Interactive Poll
    console.log("\n[13/16] Sending interactive poll...");
    const r13 = await postJSON({
      to: TARGET_PHONE,
      poll: {
        name: "Rate the Swift Project Gateway interface and robustness:",
        options: ["⭐⭐⭐⭐⭐ Excellent", "⭐⭐⭐⭐ Very Good", "⭐⭐⭐ Good"],
        selectableCount: 1
      }
    });
    console.log("Status:", r13.statusCode, "Response:", r13.body);
    await sleep(2500);

    // 14. Send Image Attachment via Base64
    console.log("\n[14/16] Sending image attachment via Base64 (backward compatibility test)...");
    try {
      const imageUrl = "https://interactive-examples.mdn.mozilla.net/media/cc0-images/grapefruit-slice-332-332.jpg";
      const base64Image = await fetchBase64(imageUrl);
      const r14 = await postJSON({
        to: TARGET_PHONE,
        message: "Verify Base64 inline image rendering",
        attachment: {
          fileName: "grapefruit-base64.jpg",
          contentType: "image/jpeg",
          contentBase64: base64Image
        }
      });
      console.log("Status:", r14.statusCode, "Response:", r14.body);
    } catch (err) {
      console.error("Failed to send Base64 image:", err.message);
    }
    await sleep(2500);

    // 15. Send PDF Document Attachment via Base64
    console.log("\n[15/16] Sending PDF document via Base64 (backward compatibility test)...");
    try {
      const pdfUrl = "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
      const base64Pdf = await fetchBase64(pdfUrl);
      const r15 = await postJSON({
        to: TARGET_PHONE,
        message: "Verify Base64 document attachment",
        attachment: {
          fileName: "report-base64.pdf",
          contentType: "application/pdf",
          contentBase64: base64Pdf
        }
      });
      console.log("Status:", r15.statusCode, "Response:", r15.body);
    } catch (err) {
      console.error("Failed to send Base64 PDF:", err.message);
    }
    await sleep(2500);

    // 16. Send Sticker via Base64
    console.log("\n[16/16] Sending sticker via Base64 (backward compatibility test)...");
    try {
      const realStickerUrl = "https://raw.githubusercontent.com/WhatsApp/stickers/master/Android/app/src/main/assets/1/01_Cuppy_smile.webp";
      const base64Sticker = await fetchBase64(realStickerUrl);
      const r16 = await postJSON({
        to: TARGET_PHONE,
        sticker: base64Sticker
      });
      console.log("Status:", r16.statusCode, "Response:", r16.body);
    } catch (err) {
      console.error("Failed to send Base64 sticker:", err.message);
    }

    console.log("\n--------------------------------------------------");
    console.log("🎉 ALL 16 COMPREHENSIVE SWIFT GATEWAY FEATURES VERIFIED!");
    console.log("--------------------------------------------------");

  } catch (err) {
    console.error("❌ Live test execution failed:", err.message);
  }
}

executeLiveTest();
