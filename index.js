const makeWASocket = require("@whiskeysockets/baileys").default;
const {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  initAuthCreds,
  BufferJSON,
  proto,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const http = require("http");
const QRCode = require("qrcode");
const qrcodeTerminal = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Load local .env file
const envPath = path.join(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const index = trimmed.indexOf("=");
      if (index !== -1) {
        const key = trimmed.substring(0, index).trim();
        let val = trimmed.substring(index + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  });
}

console.log("--------------------------------------------------");
console.log("🚀 Starting In-House Ultra-Lightweight WhatsApp Gateway");
console.log("--------------------------------------------------");

const PORT = process.env.PORT || 3001;
const AUTH_FOLDER = path.join(process.cwd(), ".baileys_auth");

let sock = null;
let latestQrCode = null;
let isConnected = false;
let authAdapter = null;

// Postgres Session Storage Adapter
async function usePostgresAuthState(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_session (
      key VARCHAR(255) PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const readData = async (key) => {
    try {
      const res = await pool.query("SELECT value FROM whatsapp_session WHERE key = $1", [key]);
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].value, BufferJSON.reviver);
      }
    } catch (e) {
      console.error(`Error reading DB key ${key}:`, e.message);
    }
    return null;
  };

  const writeData = async (key, value) => {
    try {
      const str = JSON.stringify(value, BufferJSON.replacer);
      await pool.query(
        `INSERT INTO whatsapp_session (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, str]
      );
    } catch (e) {
      console.error(`Error writing DB key ${key}:`, e.message);
    }
  };

  const deleteData = async (key) => {
    try {
      await pool.query("DELETE FROM whatsapp_session WHERE key = $1", [key]);
    } catch (e) {
      console.error(`Error deleting DB key ${key}:`, e.message);
    }
  };

  const creds = (await readData("creds")) || initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: async (type, ids) => {
          const data = {};
          await Promise.all(
            ids.map(async (id) => {
              let value = await readData(`${type}-${id}`);
              if (type === "app-state-sync-key" && value) {
                value = proto.Message.AppStateSyncKeyData.fromObject(value);
              }
              data[id] = value;
            })
          );
          return data;
        },
        set: async (data) => {
          const tasks = [];
          for (const category in data) {
            for (const id in data[category]) {
              const value = data[category][id];
              const key = `${category}-${id}`;
              if (value) {
                tasks.push(writeData(key, value));
              } else {
                tasks.push(deleteData(key));
              }
            }
          }
          await Promise.all(tasks);
        },
      },
    },
    saveCreds: () => writeData("creds", creds),
    clearAuth: async () => {
      try {
        await pool.query("TRUNCATE TABLE whatsapp_session");
      } catch (e) {}
    },
  };
}

async function getAuthState() {
  if (process.env.DATABASE_URL) {
    try {
      console.log("🗄️ Using PostgreSQL Database for 100% Persistent WhatsApp Auth Session");
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
      });
      authAdapter = await usePostgresAuthState(pool);
      return authAdapter;
    } catch (e) {
      console.error("⚠️ Failed to initialize Postgres auth, falling back to local file auth:", e.message);
    }
  }
  console.log("📁 Using local file storage for auth session");
  authAdapter = await useMultiFileAuthState(AUTH_FOLDER);
  return authAdapter;
}

async function startWhatsAppGateway() {
  try {
    const { state, saveCreds } = await getAuthState();
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: state,
      generateHighQualityLinkPreview: false,
      browser: ["HRMS Private Gateway", "Chrome", "1.0.0"],
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;
      if (qr) {
        latestQrCode = qr;
        console.log("\n📲 SCAN THIS QR CODE WITH YOUR WHATSAPP APP (Linked Devices):\n");
        qrcodeTerminal.generate(qr, { small: true });
        console.log(`\nOr view web QR code at: http://localhost:${PORT}/qr\n`);
      }

      if (connection === "close") {
        isConnected = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`⚠️ Connection closed (status ${statusCode}). Reconnecting: ${shouldReconnect}`);

        if (shouldReconnect) {
          setTimeout(startWhatsAppGateway, 3000);
        } else {
          console.log("❌ Device logged out. Clearing authentication session...");
          latestQrCode = null;
          if (authAdapter && authAdapter.clearAuth) {
            await authAdapter.clearAuth();
          }
          try {
            fs.rmSync(AUTH_FOLDER, { recursive: true, force: true });
          } catch (e) {}
          setTimeout(startWhatsAppGateway, 3000);
        }
      } else if (connection === "open") {
        isConnected = true;
        latestQrCode = null;
        console.log("--------------------------------------------------");
        console.log(`🎉 WhatsApp Gateway is ACTIVE and READY on PORT ${PORT}`);
        console.log("--------------------------------------------------");
      }
    });
  } catch (err) {
    console.error("❌ Gateway initialization error:", err);
    setTimeout(startWhatsAppGateway, 5000);
  }
}

startWhatsAppGateway();

// HTTP Gateway Server
const API_TOKEN = process.env.WHATSAPP_API_TOKEN;

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

  // Web Display & QR Display Route
  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/qr" || url.pathname === "/qr/")) {
    if (API_TOKEN) {
      const authHeader = req.headers["authorization"];
      const queryToken = url.searchParams.get("token");
      let authorized = false;

      if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
        authorized = authHeader.substring(7).trim() === API_TOKEN;
      } else if (queryToken === API_TOKEN) {
        authorized = true;
      }

      if (!authorized) {
        res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            success: false,
            error: "Unauthorized. Please specify a valid 'token' query parameter or Authorization Bearer header.",
          })
        );
        return;
      }
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (isConnected) {
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>WhatsApp Gateway Active</title>
            <meta http-equiv="refresh" content="5">
          </head>
          <body style="font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#f0fdf4; color:#166534; margin:0;">
            <div style="background:white; padding:40px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.05); text-align:center; max-width:400px; width:90%;">
              <div style="font-size:48px; margin-bottom:12px;">🎉</div>
              <h2 style="margin:0 0 10px 0; color:#15803d;">WhatsApp Gateway Active</h2>
              <p style="color:#475569; font-size:14px; line-height:1.5; margin:0;">Your WhatsApp device is linked and ready to send broadcasts.</p>
            </div>
          </body>
        </html>
      `);
      return;
    }

    if (latestQrCode) {
      try {
        const qrImageDataUrl = await QRCode.toDataURL(latestQrCode, { width: 300, margin: 2 });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Scan WhatsApp QR Code</title>
              <meta http-equiv="refresh" content="6">
            </head>
            <body style="font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#f8fafc; color:#0f172a; margin:0; padding:20px;">
              <div style="background:white; padding:32px; border-radius:24px; box-shadow:0 20px 40px rgba(0,0,0,0.08); text-align:center; max-width:360px; width:100%;">
                <div style="font-size:36px; margin-bottom:8px;">📲</div>
                <h3 style="margin:0 0 8px 0; font-size:20px; color:#0f172a;">Link WhatsApp Device</h3>
                <p style="color:#64748b; font-size:13px; margin:0 0 20px 0;">Open WhatsApp ➔ Linked Devices ➔ Scan QR Code</p>
                <img src="${qrImageDataUrl}" alt="WhatsApp QR Code" style="width:260px; height:260px; border-radius:16px; border:1px solid #e2e8f0; padding:8px;" />
                <p style="color:#94a3b8; font-size:11px; margin:16px 0 0 0;">Auto-refreshes every 6 seconds</p>
              </div>
            </body>
          </html>
        `);
        return;
      } catch (e) {
        console.error("Failed to generate QR web image:", e);
      }
    }

    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Initializing WhatsApp Gateway</title>
          <meta http-equiv="refresh" content="3">
        </head>
        <body style="font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#f8fafc; color:#475569; margin:0;">
          <div style="background:white; padding:32px; border-radius:24px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
            <div style="font-size:36px; margin-bottom:10px;">⏳</div>
            <h3 style="margin:0 0 8px 0; color:#0f172a;">Initializing WhatsApp Gateway...</h3>
            <p style="margin:0; font-size:13px; color:#64748b;">Please wait a few seconds for the QR code to load.</p>
          </div>
        </body>
      </html>
    `);
    return;
  }

  if (req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });

    req.on("end", async () => {
      try {
        let data = {};
        try {
          data = JSON.parse(body || "{}");
        } catch (e) {}

        if (API_TOKEN) {
          const authHeader = req.headers["authorization"];
          const bodyToken = data.token;
          const queryToken = url.searchParams.get("token");
          let authorized = false;

          if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
            authorized = authHeader.substring(7).trim() === API_TOKEN;
          } else if (bodyToken === API_TOKEN || queryToken === API_TOKEN) {
            authorized = true;
          }

          if (!authorized) {
            res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ success: false, error: "Unauthorized. Invalid or missing API token." }));
            return;
          }
        }

        if (!isConnected || !sock) {
          res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              success: false,
              error: "WhatsApp gateway client is not ready yet. Please scan the QR code at /qr.",
            })
          );
          return;
        }

        const rawPhone = data.phone || data.to || (data.phoneNumbers && data.phoneNumbers[0]);
        const messageText = data.message || data.body;
        const attachment = data.attachment;

        if (!rawPhone || !messageText) {
          res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          res.end(
            JSON.stringify({
              success: false,
              error: "Missing required 'phone' or 'message' field.",
            })
          );
          return;
        }

        let cleaned = String(rawPhone).replace(/\D/g, "");
        if (cleaned.length === 10) {
          cleaned = `91${cleaned}`;
        }
        const jid = `${cleaned}@s.whatsapp.net`;

        console.log(`[Sending Live Baileys WhatsApp] ➡️ To: ${cleaned}`);

        if (attachment && attachment.fileName && attachment.contentBase64) {
          const buffer = Buffer.from(attachment.contentBase64, "base64");
          const mimeType = (attachment.contentType || "").toLowerCase();
          const fileName = attachment.fileName.toLowerCase();

          let messageOptions = {};

          if (mimeType.startsWith("image/") && !mimeType.includes("gif")) {
            // Send as inline image preview
            messageOptions = {
              image: buffer,
              caption: messageText,
              mimetype: attachment.contentType,
            };
          } else if (mimeType.startsWith("video/") || mimeType.includes("gif") || fileName.endsWith(".gif")) {
            // Send as inline video, or autoplaying GIF if it's a GIF
            messageOptions = {
              video: buffer,
              caption: messageText,
              mimetype: attachment.contentType || "video/mp4",
              gifPlayback: mimeType.includes("gif") || fileName.endsWith(".gif"),
            };
          } else if (mimeType.startsWith("audio/")) {
            // Send as audio message
            messageOptions = {
              audio: buffer,
              mimetype: attachment.contentType,
              caption: messageText,
            };
          } else {
            // Default to document upload (PDF, CSV, doc, xlsx, etc.)
            messageOptions = {
              document: buffer,
              fileName: attachment.fileName,
              mimetype: attachment.contentType || "application/octet-stream",
              caption: messageText,
            };
          }

          await sock.sendMessage(jid, messageOptions);
        } else {
          await sock.sendMessage(jid, { text: messageText });
        }

        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            success: true,
            recipient: cleaned,
            message: "WhatsApp message delivered successfully.",
          })
        );
      } catch (err) {
        console.error("❌ Dispatch error:", err.message);
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(
          JSON.stringify({
            success: false,
            error: err.message || "Failed to send WhatsApp message.",
          })
        );
      }
    });
  } else {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        status: "active",
        ready: isConnected,
        authenticated: isConnected,
        qrWebUrl: `http://localhost:${PORT}/qr`,
        service: "In-House WhatsApp Ultra-Lightweight Gateway",
      })
    );
  }
});

server.listen(PORT, () => {
  console.log(`📡 Listening for WhatsApp dispatches on port ${PORT}...`);
});
