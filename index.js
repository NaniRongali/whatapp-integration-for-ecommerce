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
const { exec } = require("child_process");
const os = require("os");
const crypto = require("crypto");
const { Jimp } = require("jimp");

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
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
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

async function downloadUrlToBuffer(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch URL: ${response.statusText} (${response.status})`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "";

  const parsedUrl = new URL(url);
  const pathname = parsedUrl.pathname;
  let fileName = pathname.substring(pathname.lastIndexOf("/") + 1) || "file";

  if (!fileName.includes(".") && contentType) {
    const ext = contentType.split("/")[1];
    if (ext) {
      fileName = `${fileName}.${ext}`;
    }
  }

  return { buffer, contentType, fileName };
}

async function optimizeImageIfPossible(buffer, contentType) {
  try {
    const mime = (contentType || "").toLowerCase();
    if (
      mime.startsWith("image/") &&
      !mime.includes("gif") &&
      !mime.includes("webp")
    ) {
      const img = await Jimp.read(buffer);
      let resized = false;
      if (img.width > 1600 || img.height > 1600) {
        img.resize({ w: 1600 });
        resized = true;
      }
      const optimizedBuffer = await img.getBuffer(mime, { quality: 80 });
      console.log(
        `[Media Optimization]: Image optimized (quality: 80%, resized: ${resized}). Size reduced from ${buffer.length} to ${optimizedBuffer.length} bytes.`,
      );
      return optimizedBuffer;
    }
  } catch (err) {
    console.warn(
      `[Media Optimization Alert]: Jimp image processing failed. Using original buffer. Reason: ${err.message}`,
    );
  }
  return buffer;
}

function isFFmpegAvailable() {
  return new Promise((resolve) => {
    exec("ffmpeg -version", (err) => {
      resolve(!err);
    });
  });
}

function compressVideoIfPossible(buffer) {
  return new Promise(async (resolve) => {
    try {
      const ffmpegExists = await isFFmpegAvailable();
      if (!ffmpegExists) {
        console.log(
          "[Media Optimization]: FFmpeg not installed. Skipping video compression.",
        );
        resolve(buffer);
        return;
      }

      const tempDir = os.tmpdir();
      const rand = crypto.randomBytes(6).toString("hex");
      const inputPath = path.join(tempDir, `swift_in_${rand}.mp4`);
      const outputPath = path.join(tempDir, `swift_out_${rand}.mp4`);

      fs.writeFileSync(inputPath, buffer);

      const command = `ffmpeg -y -i "${inputPath}" -vcodec libx264 -crf 28 -preset superfast -acodec aac -b:a 128k "${outputPath}"`;

      exec(command, (err) => {
        try {
          if (err) {
            console.warn(
              `[Media Optimization Alert]: FFmpeg video compression failed. Using original buffer. Reason: ${err.message}`,
            );
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            resolve(buffer);
            return;
          }

          if (fs.existsSync(outputPath)) {
            const compressedBuffer = fs.readFileSync(outputPath);
            console.log(
              `[Media Optimization]: Video optimized (CRF: 28). Size reduced from ${buffer.length} to ${compressedBuffer.length} bytes.`,
            );
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
            resolve(compressedBuffer);
          } else {
            if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
            resolve(buffer);
          }
        } catch (e) {
          console.warn(
            "[Media Optimization Alert]: Video compression cleanup error:",
            e.message,
          );
          resolve(buffer);
        }
      });
    } catch (err) {
      console.warn(
        `[Media Optimization Alert]: Video processing error. Using original buffer. Reason: ${err.message}`,
      );
      resolve(buffer);
    }
  });
}

const PORT = process.env.PORT || 3001;
let dbPool = null;

// Registry of all active sessions
const activeSessions = new Map();
// Structure of entry:
// sessionId => { sock, isConnected, latestQrCode, qrTimeout }

// Postgres Session Storage Adapter
async function usePostgresAuthState(pool, sessionId) {
  // Perform schema migration if the old whatsapp_session table exists without session_id
  await pool.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_session (
      session_id VARCHAR(255) NOT NULL,
      key VARCHAR(255) NOT NULL,
      value TEXT NOT NULL,
      PRIMARY KEY (session_id, key)
    );
  `);

  try {
    const checkCol = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'whatsapp_session' AND column_name = 'session_id'
    `);
    if (checkCol.rows.length === 0) {
      console.log("Migrating database schema to support Multi-Session...");
      await pool.query(`
        ALTER TABLE whatsapp_session RENAME TO whatsapp_session_old;
        CREATE TABLE whatsapp_session (
          session_id VARCHAR(255) NOT NULL,
          key VARCHAR(255) NOT NULL,
          value TEXT NOT NULL,
          PRIMARY KEY (session_id, key)
        );
        INSERT INTO whatsapp_session (session_id, key, value)
        SELECT 'default', key, value FROM whatsapp_session_old;
        DROP TABLE whatsapp_session_old;
      `);
      console.log(
        "🗄️ Database migration complete! All existing credentials migrated to session 'default'.",
      );
    }
  } catch (e) {
    console.error("Schema migration check error:", e.message);
  }

  const readData = async (key) => {
    try {
      const res = await pool.query(
        "SELECT value FROM whatsapp_session WHERE session_id = $1 AND key = $2",
        [sessionId, key],
      );
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].value, BufferJSON.reviver);
      }
    } catch (e) {
      console.error(
        `Error reading DB key ${key} for session ${sessionId}:`,
        e.message,
      );
    }
    return null;
  };

  const writeData = async (key, value) => {
    try {
      const str = JSON.stringify(value, BufferJSON.replacer);
      await pool.query(
        `INSERT INTO whatsapp_session (session_id, key, value) VALUES ($1, $2, $3)
         ON CONFLICT (session_id, key) DO UPDATE SET value = EXCLUDED.value`,
        [sessionId, key, str],
      );
    } catch (e) {
      console.error(
        `Error writing DB key ${key} for session ${sessionId}:`,
        e.message,
      );
    }
  };

  const deleteData = async (key) => {
    try {
      await pool.query(
        "DELETE FROM whatsapp_session WHERE session_id = $1 AND key = $2",
        [sessionId, key],
      );
    } catch (e) {
      console.error(
        `Error deleting DB key ${key} for session ${sessionId}:`,
        e.message,
      );
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
            }),
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
  };
}

async function getAuthState(sessionId) {
  if (process.env.DATABASE_URL) {
    try {
      if (!dbPool) {
        dbPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl:
            process.env.NODE_ENV === "production"
              ? { rejectUnauthorized: false }
              : undefined,
        });
      }
      return await usePostgresAuthState(dbPool, sessionId);
    } catch (e) {
      console.error(
        `Failed to initialize Postgres auth for session ${sessionId}, falling back to local file auth:`,
        e.message,
      );
    }
  }
  const folder = path.join(process.cwd(), `.baileys_auth_${sessionId}`);
  return await useMultiFileAuthState(folder);
}

async function clearSessionAuth(sessionId) {
  if (process.env.DATABASE_URL && dbPool) {
    try {
      await dbPool.query("DELETE FROM whatsapp_session WHERE session_id = $1", [
        sessionId,
      ]);
    } catch (e) {
      console.error(
        `Error clearing DB credentials for session ${sessionId}:`,
        e.message,
      );
    }
  }
  const folder = path.join(process.cwd(), `.baileys_auth_${sessionId}`);
  try {
    fs.rmSync(folder, { recursive: true, force: true });
  } catch (e) {}
}

async function processSessionQueue(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session || session.isProcessing) return;

  session.isProcessing = true;

  try {
    while (session.queue.length > 0) {
      if (!session.isConnected || !session.sock) {
        console.warn(
          `[Session: ${sessionId}] Queue paused: WhatsApp client is disconnected. Waiting for reconnection...`,
        );
        break;
      }

      const now = Date.now();
      const timeSinceLastSend = now - (session.lastSendTime || 0);
      const minDelay = session.lastDelay || (Math.floor(Math.random() * 2000) + 2000);

      if (timeSinceLastSend < minDelay) {
        const sleepTime = minDelay - timeSinceLastSend;
        await new Promise((resolve) => setTimeout(resolve, sleepTime));
      }

      const task = session.queue.shift();
      try {
        await task();
      } catch (err) {
        console.error(
          `[WhatsApp API Error] Queue dispatch failed in session '${sessionId}': Reason: ${err.message}`,
        );
      }

      session.lastSendTime = Date.now();
      session.lastDelay = Math.floor(Math.random() * 2000) + 2000;
    }
  } catch (err) {
    console.error(
      `[Session: ${sessionId}] Queue worker critical error:`,
      err.message,
    );
  } finally {
    session.isProcessing = false;
  }
}

function getOrInitSession(sessionId) {
  if (activeSessions.has(sessionId)) {
    return activeSessions.get(sessionId);
  }

  const sessionData = {
    sock: null,
    isConnected: false,
    latestQrCode: null,
    queue: [],
    isProcessing: false,
    lastSendTime: 0,
    lastDelay: 0,
  };
  activeSessions.set(sessionId, sessionData);

  const initialize = async () => {
    try {
      const { state, saveCreds } = await getAuthState(sessionId);
      const { version } = await fetchLatestBaileysVersion().catch(() => ({
        version: [2, 3000, 1015901307],
      }));

      console.log(`[Session: ${sessionId}] 🔌 Initializing socket...`);

      const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
        generateHighQualityLinkPreview: false,
        browser: [`Swift Project (${sessionId})`, "Chrome", "1.0.0"],
      });

      sessionData.sock = sock;

      sock.ev.on("creds.update", saveCreds);

      sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          sessionData.latestQrCode = qr;
          console.log(
            `[Session: ${sessionId}] 📲 QR Code updated. View at: http://localhost:${PORT}/qr?session=${sessionId}`,
          );
        }

        if (connection === "close") {
          sessionData.isConnected = false;
          const statusCode = lastDisconnect?.error?.output?.statusCode;
          const shouldReconnect =
            statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

          console.log(
            `[Session: ${sessionId}] ⚠️ Connection closed (status ${statusCode}). Reconnecting: ${shouldReconnect}`,
          );

          if (shouldReconnect) {
            setTimeout(initialize, 3000);
          } else {
            console.log(
              `[Session: ${sessionId}] ❌ Device logged out. Clearing authentication...`,
            );
            sessionData.latestQrCode = null;
            await clearSessionAuth(sessionId);
            activeSessions.delete(sessionId);

            // Re-init as fresh session immediately
            setTimeout(() => getOrInitSession(sessionId), 3000);
          }
        } else if (connection === "open") {
          sessionData.isConnected = true;
          sessionData.latestQrCode = null;
          console.log(
            `[Session: ${sessionId}] ✅ Connected to WhatsApp successfully! User: ${sock.user?.id || ""}`,
          );
          processSessionQueue(sessionId);
        }
      });
    } catch (err) {
      console.error(
        `[Session: ${sessionId}] Socket initialization failed:`,
        err.message,
      );
      setTimeout(initialize, 5000);
    }
  };

  initialize();
  return sessionData;
}

async function getStoredSessionsFromDb() {
  if (process.env.DATABASE_URL) {
    try {
      if (!dbPool) {
        dbPool = new Pool({
          connectionString: process.env.DATABASE_URL,
          ssl:
            process.env.NODE_ENV === "production"
              ? { rejectUnauthorized: false }
              : undefined,
        });
      }
      const res = await dbPool.query(
        "SELECT DISTINCT session_id FROM whatsapp_session",
      );
      return res.rows.map((row) => row.session_id);
    } catch (e) {
      console.error("Error listing stored DB sessions:", e.message);
    }
  }
  return [];
}

function getStoredSessionsFromFiles() {
  try {
    const files = fs.readdirSync(process.cwd());
    const sessions = [];
    for (const file of files) {
      if (
        file.startsWith(".baileys_auth_") &&
        fs.statSync(file).isDirectory()
      ) {
        const sessionId = file.replace(".baileys_auth_", "");
        if (sessionId) {
          sessions.push(sessionId);
        }
      }
    }
    return sessions;
  } catch (e) {
    return [];
  }
}

async function loadAllStoredSessions() {
  try {
    const dbSessions = await getStoredSessionsFromDb();
    const fileSessions = getStoredSessionsFromFiles();
    const allSessions = Array.from(new Set([...dbSessions, ...fileSessions]));

    if (allSessions.length === 0) {
      allSessions.push("default");
    }

    console.log(
      `📡 Restoring ${allSessions.length} active WhatsApp sessions: [${allSessions.join(", ")}]...`,
    );
    for (const sessionId of allSessions) {
      getOrInitSession(sessionId);
    }
  } catch (e) {
    console.error("Error autoloading sessions:", e.message);
    getOrInitSession("default");
  }
}

// Start all sessions on boot
loadAllStoredSessions();

// HTTP Gateway Server
const API_TOKEN = process.env.WHATSAPP_API_TOKEN;

function isAuthorized(req, url, bodyData = {}) {
  if (!API_TOKEN) return true;
  const authHeader = req.headers["authorization"];
  const queryToken = url.searchParams.get("token");
  const bodyToken = bodyData.token;

  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.substring(7).trim() === API_TOKEN;
  }
  return queryToken === API_TOKEN || bodyToken === API_TOKEN;
}

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

  // 1. GET /sessions - list all active sessions
  if (req.method === "GET" && url.pathname === "/sessions") {
    if (!isAuthorized(req, url)) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Unauthorized. Invalid or missing API token.",
        }),
      );
      return;
    }

    const sessionsList = [];
    for (const [id, sData] of activeSessions.entries()) {
      sessionsList.push({
        id,
        status: sData.isConnected
          ? "CONNECTED"
          : sData.latestQrCode
            ? "PENDING_SCAN"
            : "INITIALIZING",
        phone: sData.sock?.user?.id
          ? sData.sock.user.id.split(":")[0].split("@")[0]
          : null,
      });
    }

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ success: true, sessions: sessionsList }));
    return;
  }

  // 1.5. DELETE /sessions - delete session and log out
  if (req.method === "DELETE" && url.pathname === "/sessions") {
    if (!isAuthorized(req, url)) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Unauthorized. Invalid or missing API token.",
        }),
      );
      return;
    }

    const sessionId = url.searchParams.get("session");
    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Missing required 'session' query parameter.",
        }),
      );
      return;
    }

    const sData = activeSessions.get(sessionId);
    if (!sData) {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: `Session '${sessionId}' not found.`,
        }),
      );
      return;
    }

    console.log(
      `[Session: ${sessionId}] Remote delete requested. Logging out and clearing credentials...`,
    );

    if (sData.sock && sData.isConnected) {
      try {
        await sData.sock.logout();
      } catch (err) {
        console.warn(
          `[Session: ${sessionId}] Socket logout failed, closing connection manually:`,
          err.message,
        );
        try {
          sData.sock.end(undefined);
        } catch (e) {}
      }
    }

    await clearSessionAuth(sessionId);
    activeSessions.delete(sessionId);

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        success: true,
        message: `Session '${sessionId}' successfully logged out and deleted.`,
      }),
    );
    return;
  }

  // 1.6. GET /sessions/delete - browser-friendly session deletion
  if (req.method === "GET" && url.pathname === "/sessions/delete") {
    if (!isAuthorized(req, url)) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Unauthorized. Invalid or missing API token.",
        }),
      );
      return;
    }

    const sessionId = url.searchParams.get("session");
    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Missing required 'session' query parameter.",
        }),
      );
      return;
    }

    const sData = activeSessions.get(sessionId);
    if (!sData) {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: `Session '${sessionId}' not found.`,
        }),
      );
      return;
    }

    console.log(
      `[Session: ${sessionId}] Remote delete requested via GET. Logging out and clearing credentials...`,
    );

    if (sData.sock && sData.isConnected) {
      try {
        await sData.sock.logout();
      } catch (err) {
        console.warn(
          `[Session: ${sessionId}] Socket logout failed, closing connection manually:`,
          err.message,
        );
        try {
          sData.sock.end(undefined);
        } catch (e) {}
      }
    }

    await clearSessionAuth(sessionId);
    activeSessions.delete(sessionId);

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        success: true,
        message: `Session '${sessionId}' successfully logged out and deleted via browser URL.`,
      }),
    );
    return;
  }

  // 2. GET /status - status of a single session
  if (req.method === "GET" && url.pathname === "/status") {
    if (!isAuthorized(req, url)) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Unauthorized. Invalid or missing API token.",
        }),
      );
      return;
    }

    const sessionId = url.searchParams.get("session") || "default";
    const sData = activeSessions.get(sessionId);

    if (!sData) {
      res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: `Session '${sessionId}' not found.`,
        }),
      );
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        success: true,
        session: sessionId,
        status: sData.isConnected
          ? "CONNECTED"
          : sData.latestQrCode
            ? "PENDING_SCAN"
            : "INITIALIZING",
        phone: sData.sock?.user?.id
          ? sData.sock.user.id.split(":")[0].split("@")[0]
          : null,
        queueLength: sData.queue ? sData.queue.length : 0,
      }),
    );
    return;
  }

  // 3. GET /qr or / - Web Display & QR Display Route
  if (
    req.method === "GET" &&
    (url.pathname === "/" || url.pathname === "/qr" || url.pathname === "/qr/")
  ) {
    if (!isAuthorized(req, url)) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          success: false,
          error: "Unauthorized. Invalid or missing API token.",
        }),
      );
      return;
    }

    const sessionId = url.searchParams.get("session") || "default";
    const session = getOrInitSession(sessionId);

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    if (session.isConnected) {
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>WhatsApp Gateway Active - Session: ${sessionId}</title>
            <meta http-equiv="refresh" content="5">
          </head>
          <body style="font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#f0fdf4; color:#166534; margin:0;">
            <div style="background:white; padding:40px; border-radius:24px; box-shadow:0 10px 25px rgba(0,0,0,0.05); text-align:center; max-width:400px; width:90%;">
              <div style="font-size:48px; margin-bottom:12px;">🎉</div>
              <h2 style="margin:0 0 10px 0; color:#15803d;">WhatsApp Session Active</h2>
              <p style="color:#475569; font-size:14px; line-height:1.5; margin:0 0 16px 0;">Session <strong>${sessionId}</strong> is linked and ready to send broadcasts.</p>
              <span style="background:#dcfce7; padding:6px 12px; border-radius:12px; font-size:12px; font-weight:bold; color:#166534;">Connected JID: ${session.sock?.user?.id ? session.sock.user.id.split(":")[0] : ""}</span>
            </div>
          </body>
        </html>
      `);
      return;
    }

    if (session.latestQrCode) {
      try {
        const qrImageDataUrl = await QRCode.toDataURL(session.latestQrCode, {
          width: 300,
          margin: 2,
        });
        res.end(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <title>Scan QR Code - Session: ${sessionId}</title>
              <meta http-equiv="refresh" content="6">
            </head>
            <body style="font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#f8fafc; color:#0f172a; margin:0; padding:20px;">
              <div style="background:white; padding:32px; border-radius:24px; box-shadow:0 20px 40px rgba(0,0,0,0.08); text-align:center; max-width:360px; width:100%;">
                <div style="font-size:36px; margin-bottom:8px;">📲</div>
                <h3 style="margin:0 0 8px 0; font-size:20px; color:#0f172a;">Link WhatsApp Session</h3>
                <p style="color:#64748b; font-size:13px; margin:0 0 6px 0;">Session ID: <strong>${sessionId}</strong></p>
                <p style="color:#94a3b8; font-size:12px; margin:0 0 20px 0;">Open WhatsApp ➔ Linked Devices ➔ Scan QR Code</p>
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
          <title>Initializing WhatsApp Session: ${sessionId}</title>
          <meta http-equiv="refresh" content="3">
        </head>
        <body style="font-family:system-ui,-apple-system,sans-serif; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#f8fafc; color:#475569; margin:0;">
          <div style="background:white; padding:32px; border-radius:24px; text-align:center; box-shadow:0 10px 25px rgba(0,0,0,0.05);">
            <div style="font-size:36px; margin-bottom:10px;">⏳</div>
            <h3 style="margin:0 0 8px 0; color:#0f172a;">Initializing Session '${sessionId}'...</h3>
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
            res.writeHead(401, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error: "Unauthorized. Invalid or missing API token.",
              }),
            );
            return;
          }
        }

        const sessionId =
          data.session || url.searchParams.get("session") || "default";
        const session = getOrInitSession(sessionId);

        const rawPhone =
          data.phone || data.to || (data.phoneNumbers && data.phoneNumbers[0]);
        const messageText = data.message || data.body;
        const attachment = data.attachment;
        const location = data.location;
        const contact = data.contact;
        const sticker = data.sticker;
        const poll = data.poll;
        const reaction = data.reaction;
        const presence = data.presence;
        const contactsList = data.contactsList;

        if (!rawPhone) {
          console.warn(
            "[API Validation Failed]: Rejected request. Missing required 'phone' or 'to' field.",
          );
          res.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              success: false,
              error: "Missing required 'phone' or 'to' field.",
            }),
          );
          return;
        }

        if (
          !messageText &&
          !attachment &&
          !location &&
          !contact &&
          !sticker &&
          !poll &&
          !reaction &&
          !presence &&
          !contactsList
        ) {
          console.warn(
            `[API Validation Failed]: Rejected request for '${rawPhone}'. Missing message content.`,
          );
          res.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              success: false,
              error:
                "Missing message content. You must provide one of: 'message', 'attachment', 'location', 'contact', 'sticker', 'poll', 'reaction', 'presence', or 'contactsList'.",
            }),
          );
          return;
        }

        const countryCode = data.countryCode || data.phoneCode;
        let cleaned = String(rawPhone).replace(/\D/g, "");

        if (countryCode) {
          const cleanedCode = String(countryCode).replace(/\D/g, "");
          if (!cleaned.startsWith(cleanedCode)) {
            cleaned = `${cleanedCode}${cleaned}`;
          }
        } else if (cleaned.length === 10) {
          cleaned = `91${cleaned}`;
        }

        if (cleaned.length < 7 || cleaned.length > 15) {
          console.warn(
            `[API Validation Failed]: Rejected request for '${rawPhone}'. Normalized number '${cleaned}' must be between 7 and 15 digits.`,
          );
          res.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              success: false,
              error: `Invalid phone number format: '${rawPhone}'. Normalization result '${cleaned}' must contain 7 to 15 digits.`,
            }),
          );
          return;
        }

        if (attachment && typeof attachment === "object") {
          if (
            !attachment.url &&
            (!attachment.fileName || !attachment.contentBase64)
          ) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. Attachment must include 'url' or both 'fileName' and 'contentBase64'.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error:
                  "Attachment must include either 'url' or both 'fileName' and 'contentBase64'.",
              }),
            );
            return;
          }
        } else if (location && typeof location === "object") {
          const { latitude, longitude } = location;
          if (latitude === undefined || longitude === undefined) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. Missing coordinates inside location.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error:
                  "Missing required 'latitude' or 'longitude' fields inside location.",
              }),
            );
            return;
          }
        } else if (contact && typeof contact === "object") {
          const { fullName, phone } = contact;
          if (!fullName || !phone) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. Missing required fields inside contact.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error:
                  "Missing required 'fullName' or 'phone' fields inside contact.",
              }),
            );
            return;
          }
        } else if (poll && typeof poll === "object") {
          const { name, options } = poll;
          if (!name || !Array.isArray(options) || options.length < 2) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. Poll must contain a name and at least 2 options.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error:
                  "Poll must include a 'name' string and an 'options' array containing at least 2 items.",
              }),
            );
            return;
          }
        } else if (reaction && typeof reaction === "object") {
          const { emoji, messageId } = reaction;
          if (!emoji || !messageId) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. Reaction must include emoji and messageId.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error: "Reaction must include both 'emoji' and 'messageId'.",
              }),
            );
            return;
          }
        } else if (presence) {
          const validPresence = [
            "composing",
            "recording",
            "paused",
            "available",
            "unavailable",
          ];
          if (!validPresence.includes(presence)) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. Invalid presence value '${presence}'.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error: `Invalid presence value. Must be one of: ${validPresence.join(", ")}`,
              }),
            );
            return;
          }
        } else if (contactsList) {
          if (!Array.isArray(contactsList) || contactsList.length === 0) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. contactsList must be a non-empty array.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error: "contactsList must be a non-empty array.",
              }),
            );
            return;
          }
          for (const c of contactsList) {
            if (!c.fullName || !c.phone) {
              console.warn(
                `[API Validation Failed]: Rejected request for '${rawPhone}'. Missing contact details inside contactsList item.`,
              );
              res.writeHead(400, {
                "Content-Type": "application/json; charset=utf-8",
              });
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    "Each contact in contactsList must contain both 'fullName' and 'phone'.",
                }),
              );
              return;
            }
          }
        }

        if (!session.sock) {
          console.warn(
            `[Session Not Found]: Cannot queue message. Session '${sessionId}' is not active.`,
          );
          res.writeHead(503, {
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              success: false,
              error: `WhatsApp gateway session '${sessionId}' is not ready yet. Please scan the QR code at /qr?session=${sessionId}`,
            }),
          );
          return;
        }

        const jid = `${cleaned}@s.whatsapp.net`;
        const mentionsJids = [];
        if (Array.isArray(data.mentions)) {
          data.mentions.forEach((num) => {
            const cleanNum = String(num).replace(/\D/g, "");
            if (cleanNum) {
              mentionsJids.push(`${cleanNum}@s.whatsapp.net`);
            }
          });
        }

        const sendOptions = {};
        if (data.quotedMessageId) {
          sendOptions.quoted = {
            key: {
              remoteJid: jid,
              fromMe:
                data.quotedFromMe !== undefined ? data.quotedFromMe : false,
              id: data.quotedMessageId,
            },
            message: {
              conversation: data.quotedMessageText || "",
            },
          };
        }

        let stickerBuffer = null;
        let buffer = null;
        let mimeType = null;
        let fileName = null;

        if (
          sticker ||
          (attachment &&
            (attachment.isSticker ||
              (attachment.contentType &&
                attachment.contentType.toLowerCase() === "image/webp")))
        ) {
          if (sticker) {
            if (
              sticker.startsWith("http://") ||
              sticker.startsWith("https://")
            ) {
              const download = await downloadUrlToBuffer(sticker);
              stickerBuffer = download.buffer;
            } else {
              stickerBuffer = Buffer.from(sticker, "base64");
            }
          } else {
            if (attachment.url) {
              const download = await downloadUrlToBuffer(attachment.url);
              stickerBuffer = download.buffer;
            } else {
              stickerBuffer = Buffer.from(attachment.contentBase64, "base64");
            }
          }

          const MAX_SIZE = 200 * 1024 * 1024;
          if (stickerBuffer.length > MAX_SIZE) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. Sticker size (${(stickerBuffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds the 200MB limit.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error: "File size exceeds the maximum limit of 200MB.",
              }),
            );
            return;
          }
        } else if (attachment && (attachment.contentBase64 || attachment.url)) {
          if (attachment.url) {
            const download = await downloadUrlToBuffer(attachment.url);
            buffer = download.buffer;
            mimeType = (
              attachment.contentType ||
              download.contentType ||
              ""
            ).toLowerCase();
            fileName = (
              attachment.fileName ||
              download.fileName ||
              "file"
            ).toLowerCase();
          } else {
            buffer = Buffer.from(attachment.contentBase64, "base64");
            mimeType = (attachment.contentType || "").toLowerCase();
            fileName = (attachment.fileName || "").toLowerCase();
          }

          const MAX_SIZE = 200 * 1024 * 1024;
          if (buffer.length > MAX_SIZE) {
            console.warn(
              `[API Validation Failed]: Rejected request for '${rawPhone}'. Attachment size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds the 200MB limit.`,
            );
            res.writeHead(400, {
              "Content-Type": "application/json; charset=utf-8",
            });
            res.end(
              JSON.stringify({
                success: false,
                error: "File size exceeds the maximum limit of 200MB.",
              }),
            );
            return;
          }

          if (
            mimeType.startsWith("image/") &&
            !mimeType.includes("gif") &&
            !mimeType.includes("webp")
          ) {
            buffer = await optimizeImageIfPossible(buffer, mimeType);
          } else if (
            mimeType.startsWith("video/") &&
            !fileName.endsWith(".gif")
          ) {
            buffer = await compressVideoIfPossible(buffer);
          }
        }

        const task = async () => {
          const sock = session.sock;
          if (!sock)
            throw new Error("Socket disconnected before processing task.");

          if (presence) {
            await sock.sendPresenceUpdate(presence, jid);
          } else if (poll && typeof poll === "object") {
            await sock.sendMessage(
              jid,
              {
                poll: {
                  name: poll.name,
                  values: poll.options,
                  selectableCount:
                    poll.selectableCount !== undefined
                      ? poll.selectableCount
                      : 1,
                },
              },
              sendOptions,
            );
          } else if (reaction && typeof reaction === "object") {
            const { emoji, messageId, fromMe } = reaction;
            await sock.sendMessage(jid, {
              react: {
                text: emoji,
                key: {
                  remoteJid: jid,
                  fromMe: fromMe !== undefined ? fromMe : false,
                  id: messageId,
                },
              },
            });
          } else if (contactsList && Array.isArray(contactsList)) {
            const contacts = contactsList.map((c) => {
              const fullName = c.fullName;
              const organization = c.organization || "";
              const phone = c.phone;
              const cleanContactPhone = String(phone).replace(/\D/g, "");
              const vcard =
                `BEGIN:VCARD\n` +
                `VERSION:3.0\n` +
                `FN:${fullName}\n` +
                (organization ? `ORG:${organization};\n` : "") +
                `TEL;type=CELL;type=VOICE;waid=${cleanContactPhone}:${phone}\n` +
                `END:VCARD`;
              return { displayName: fullName, vcard };
            });

            await sock.sendMessage(
              jid,
              {
                contacts: {
                  displayName: data.contactsDisplayName || "Shared Contacts",
                  contacts: contacts,
                },
              },
              sendOptions,
            );
          } else if (location && typeof location === "object") {
            const { latitude, longitude, name, address } = location;
            await sock.sendMessage(
              jid,
              {
                location: {
                  degreesLatitude: parseFloat(latitude),
                  degreesLongitude: parseFloat(longitude),
                  name: name || "",
                  address: address || "",
                },
              },
              sendOptions,
            );
          } else if (contact && typeof contact === "object") {
            const { fullName, organization, phone } = contact;
            const cleanContactPhone = String(phone).replace(/\D/g, "");
            const vcard =
              `BEGIN:VCARD\n` +
              `VERSION:3.0\n` +
              `FN:${fullName}\n` +
              (organization ? `ORG:${organization};\n` : "") +
              `TEL;type=CELL;type=VOICE;waid=${cleanContactPhone}:${phone}\n` +
              `END:VCARD`;

            await sock.sendMessage(
              jid,
              {
                contacts: {
                  displayName: fullName,
                  contacts: [{ vcard }],
                },
              },
              sendOptions,
            );
          } else if (stickerBuffer) {
            await sock.sendMessage(
              jid,
              { sticker: stickerBuffer },
              sendOptions,
            );
          } else if (buffer) {
            let messageOptions = {
              mentions: mentionsJids.length > 0 ? mentionsJids : undefined,
            };

            if (mimeType.startsWith("image/") && !mimeType.includes("gif")) {
              messageOptions.image = buffer;
              messageOptions.caption = messageText || "";
              messageOptions.mimetype = mimeType;
            } else if (
              mimeType.startsWith("video/") ||
              mimeType.includes("gif") ||
              fileName.endsWith(".gif")
            ) {
              messageOptions.video = buffer;
              messageOptions.caption = messageText || "";
              messageOptions.mimetype = mimeType || "video/mp4";
              messageOptions.gifPlayback =
                mimeType.includes("gif") || fileName.endsWith(".gif");
            } else if (mimeType.startsWith("audio/")) {
              messageOptions.audio = buffer;
              messageOptions.mimetype = mimeType;
              messageOptions.caption = messageText || "";
            } else {
              messageOptions.document = buffer;
              messageOptions.fileName = fileName;
              messageOptions.mimetype = mimeType || "application/octet-stream";
              messageOptions.caption = messageText || "";
            }

            await sock.sendMessage(jid, messageOptions, sendOptions);
          } else {
            await sock.sendMessage(
              jid,
              {
                text: messageText,
                mentions: mentionsJids.length > 0 ? mentionsJids : undefined,
              },
              sendOptions,
            );
          }
        };

        session.queue.push(task);

        console.log(
          `[Queue Add] Message added to queue for '${cleaned}' in session '${sessionId}'. Queue size: ${session.queue.length}`,
        );
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          JSON.stringify({
            success: true,
            recipient: cleaned,
            message: "Message queued successfully.",
            queuePosition: session.queue.length,
          }),
        );

        processSessionQueue(sessionId);
      } catch (err) {
        console.error(
          `[Queue Error]  Failed to enqueue message. Reason: ${err.message}`,
        );
        res.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
        });
        res.end(
          JSON.stringify({
            success: false,
            error: err.message || "Failed to process message payload.",
          }),
        );
      }
    });
  } else {
    const defaultSession = activeSessions.get("default");
    const isDefaultConnected = defaultSession
      ? defaultSession.isConnected
      : false;
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        status: "active",
        ready: isDefaultConnected,
        authenticated: isDefaultConnected,
        qrWebUrl: `http://localhost:${PORT}/qr`,
        service: "In-House WhatsApp Ultra-Lightweight Gateway",
        totalSessionsCount: activeSessions.size,
      }),
    );
  }
});

server.listen(PORT, () => {
  console.log(`Listening for WhatsApp dispatches on port ${PORT}...`);
});
