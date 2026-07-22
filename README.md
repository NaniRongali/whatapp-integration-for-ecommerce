# Standalone WhatsApp Gateway API

An ultra-lightweight, production-grade, self-hosted Node.js WhatsApp Gateway service built using `@whiskeysockets/baileys`.

This gateway allows any calling application (like a CRM, ERP, Swift Project, or web backend) to send WhatsApp messages, rich media, location pins, contact cards, stickers, interactive polls, message reactions, group tagging, and presence indicators via simple REST APIs.

---

> [!WARNING]
> **Account Ban Risk**: Excessive usage or sending messages too fast on standard personal or business WhatsApp accounts will get your number blocked as a spam bot by WhatsApp. Use at your own risk. For detailed guidelines and official Meta API alternatives, read the **[Inspiration, Warnings & Meta Alternatives](docs/inspiration-and-warnings.md)** guide.

---

## Table of Contents

- [Setup and Execution](#setup-and-execution)
- [Device Pairing](#device-pairing)
- [Authentication Rules](#authentication-rules)
- [Supported Message Types](#supported-message-types)
- [Throttling and Delays](#throttling-and-delays)
- [Inspiration and Warnings](#inspiration-and-warnings)
- [Testing the Gateway Live](#testing-the-gateway-live)
- [Message Delivery Logging](#message-delivery-logging)
- [Media Optimization and Limits](docs/media-optimization-and-limits.md)
- [Code Integration Examples](#code-integration-examples)
- [Troubleshooting and FAQs](#troubleshooting-and-faqs)

---

## Setup and Execution

### 1. Install Dependencies

Ensure you have [Node.js](https://nodejs.org/) (version 18+) installed. Run the following command in the project root directory:

```bash
npm install
```

### 2. Configure Environment Variables

Create a file named `.env` in the root directory and add the following parameters:

```env
PORT=3001

# (Optional) Prepend code for 10-digit numbers. Defaults to 91 (India) if omitted.
DEFAULT_COUNTRY_CODE=91

# (Optional) PostgreSQL database connection for 100% persistent auth sessions.
# If left commented, sessions will save locally to the ".baileys_auth" folder.
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

> [!TIP]
> Using a PostgreSQL database is highly recommended for production deployments on platforms like Docker, Render, or AWS because local files in virtual containers are deleted on redeploys.

### 3. Generate a Secure API Token

To protect your gateway from unauthorized use, generate a secure API token:

```bash
node generate-token.js
```

This script automatically generates a secure 32-byte hex token, updates it in your `.env` file under `WHATSAPP_API_TOKEN`, and prints it out. Keep this token safe!

### 4. Start the Service

```bash
npm start
```

The console will start the gateway and display a pairing QR code in the terminal.

---

## Device Pairing

Once started, the gateway must be linked to an active WhatsApp account:

1. Locate the pairing QR code printed in the terminal console.
2. Alternatively, open your browser and navigate to:
   `http://localhost:3001/qr?token=YOUR_API_TOKEN`
3. On your mobile phone, open WhatsApp ➔ **Linked Devices** ➔ **Link a Device** ➔ Scan the QR Code.
4. Once paired, the browser page and terminal will show `🎉 WhatsApp Gateway is ACTIVE and READY`.

---

## Authentication Rules

When `WHATSAPP_API_TOKEN` is set, all incoming HTTP calls require authorization. The gateway accepts the token in three ways:

1. **Authorization Header (Recommended)**
   ```http
   Authorization: Bearer YOUR_API_TOKEN
   ```
2. **Query String Parameter**
   ```http
   GET http://localhost:3001/qr?token=YOUR_API_TOKEN
   ```
3. **JSON Body Parameter (POST requests only)**
   ```json
   {
     "to": "1234567890",
     "message": "Hello",
     "token": "YOUR_API_TOKEN"
     ...
   }
   ```

---

## Supported Message Types

To accommodate developers of all experience levels, we have split the message integration guides into dedicated, granular sheets. **Click on each link below to view detailed JSON payload schemas, parameters explanation, and copy-pasteable examples:**

- ✉️ **[Text Messages](docs/text-messages.md)**: How to send standard text messages, format global numbers, and configure default country-code fallbacks.
- 📁 **[Media and File Attachments](docs/media-attachments.md)**: Sending files (PDF, CSV, Excel, Images, Videos, Audio) in-memory using stateless Base64 encoding.
- 🔗 **[Direct URL Attachments](docs/direct-url-attachments.md)**: Sending media and files (Stickers, Images, Videos, Documents, Audio) dynamically via direct file Web URLs (lightweight payloads).
- 📍 **[Location Pins](docs/location-pins.md)**: Sending maps and pin drops using latitude, longitude, and custom names/addresses.
- 👤 **[Contact Cards (vCards)](docs/contact-cards.md)**: Sharing single or multiple contact cards natively formatted as vCard compliance entries.
- 🎫 **[Stickers](docs/stickers.md)**: Delivering WebP transparency stickers (512x512 pixels).
- 📊 **[Interactive Polls](docs/polls.md)**: Sending native polls with custom options and choices selection limits (single vs. multi-select).
- 🔥 **[Message Reactions](docs/reactions.md)**: Adding, updating, or removing emoji reactions by message ID.
- 💬 **[Replies and Mentions](docs/replies-and-mentions.md)**: Replying to specific messages (quotes) and tagging/mentioning group members in group JIDs.
- ⏳ **[Presence Indicators](docs/presence-indicators.md)**: Triggering activity indicators like "typing..." or "recording audio..." in the recipient's header.

---

## Throttling and Delays

> [!IMPORTANT]
> **Account Safety Rule**: WhatsApp monitors anti-spam thresholds. Sending multiple messages too quickly will flag your account and get your number banned.
> You **must** introduce a **1.5 to 3-second delay (sleep)** in your loop when broadcasting messages sequentially.
>
> For a deep explanation of spam anti-trigger mechanisms and ready-made broadcast loops, see **[Throttling and Broadcast Loop Delays](docs/throttling-and-delays.md)**.

---

## Inspiration and Warnings

For details on why we built this self-hosted gateway, critical advice regarding account safety and spam-bot blocks, and a detailed guide on when to use this vs. when to buy a Meta Official Business API, read the **[Inspiration, Warnings & Meta Alternatives](docs/inspiration-and-warnings.md)** sheet.

---

## Testing the Gateway Live

To verify all features (typing status, standard texts, locations, contact cards, real WebP stickers, audio files, and interactive polls) are working correctly, you can run the live test scripts included in the root folder:

### 1. Test All Features (Single Recipient)

```bash
node test-live.js <phone_number>
```

_Replace `<phone_number>` with your target testing phone number (including country code, e.g., `919876543210`). The script will run all 18 validation scenarios sequentially with the safe 2.5-second throttling delay._

### 2. Test Multi-Recipient Broadcast (Safe Delays)

```bash
node test-broadcast.js <phone_number_1> <phone_number_2> ... <phone_number_N>
```

_Provide a list of phone numbers separated by spaces. The script will dispatch a broadcast to each number in the list sequentially, waiting 2.5 seconds between each call to prevent WhatsApp rate limits._

---

## Code Integration Examples

Here is how you can programmatically call this gateway from other applications.

### 1. Node.js / TypeScript (Next.js)

Below is a complete helper function that formats numbers, supports attachments, and provides a batch-sending loop with a 2-second rate-limiting delay between messages to protect your WhatsApp account from being flagged/banned:

```typescript
import fs from "fs";
import path from "path";

interface SendMessageOptions {
  to: string; // Target number (e.g. "+15551234567" or "9876543210")
  countryCode?: string; // Optional. Overrides fallback default country code (91)
  message?: string; // Required for text/media
  attachmentPath?: string; // Optional path to local file
  contentType?: string; // e.g. "application/pdf"
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contact?: {
    fullName: string;
    organization?: string;
    phone: string;
  };
  poll?: {
    name: string;
    options: string[];
    selectableCount?: number;
  };
  reaction?: {
    emoji: string;
    messageId: string;
  };
  presence?: string;
}

const GATEWAY_URL = "http://localhost:3001/";
const API_TOKEN = "YOUR_API_TOKEN";

export async function sendWhatsApp(options: SendMessageOptions) {
  let attachment = undefined;

  // Process local file to base64 if provided
  if (options.attachmentPath && fs.existsSync(options.attachmentPath)) {
    const fileBuffer = fs.readFileSync(options.attachmentPath);
    attachment = {
      fileName: path.basename(options.attachmentPath),
      contentType: options.contentType || "application/octet-stream",
      contentBase64: fileBuffer.toString("base64"),
    };
  }

  const payload = {
    to: options.to,
    countryCode: options.countryCode,
    message: options.message,
    attachment,
    location: options.location,
    contact: options.contact,
    poll: options.poll,
    reaction: options.reaction,
    presence: options.presence,
  };

  const response = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Failed to dispatch message");
  }

  return result;
}

// --- BROADCAST / BATCH SENDING WITH DELAY ---
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function broadcastToMembers(
  members: { phone: string }[],
  pollQuestion: string,
  options: string[],
) {
  console.log(`Starting broadcast to ${members.length} members...`);

  for (const member of members) {
    try {
      await sendWhatsApp({
        to: member.phone,
        poll: {
          name: pollQuestion,
          options: options,
          selectableCount: 1,
        },
      });
      console.log(`✅ Poll sent successfully to: ${member.phone}`);
    } catch (err: any) {
      console.error(
        `❌ Failed to send poll to ${member.phone}: ${err.message}`,
      );
    }

    // Spacing delay: Wait 2 seconds before sending the next one (highly recommended!)
    await sleep(2000);
  }

  console.log("Broadcast complete.");
}
```

### 2. Python

Below is a Python module using `requests` to call the gateway, with a batch sending loop that executes with a 2-second rate-limiting delay:

```python
import requests
import base64
import os
import time

GATEWAY_URL = "http://localhost:3001/"
API_TOKEN = "YOUR_API_TOKEN"

def send_whatsapp(to_number, message=None, file_path=None, content_type=None, location=None, contact=None, poll=None, reaction=None, presence=None):
    payload = {
        "to": to_number
    }

    if message:
        payload["message"] = message
    if location:
        payload["location"] = location
    if contact:
        payload["contact"] = contact
    if poll:
        payload["poll"] = poll
    if reaction:
        payload["reaction"] = reaction
    if presence:
        payload["presence"] = presence

    # Encode attachment if present
    if file_path and os.path.exists(file_path):
        with open(file_path, "rb") as f:
            file_data = f.read()
            payload["attachment"] = {
                "fileName": os.path.basename(file_path),
                "contentType": content_type or "application/octet-stream",
                "contentBase64": base64.b64encode(file_data).decode("utf-8")
            }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {API_TOKEN}"
    }

    response = requests.post(GATEWAY_URL, json=payload, headers=headers)
    return response.json()

# --- BROADCAST WITH DELAY ---
def broadcast_poll_to_list(numbers_list, poll_name, poll_options):
    print(f"Broadcasting poll to {len(numbers_list)} recipients...")

    poll_payload = {
        "name": poll_name,
        "options": poll_options,
        "selectableCount": 1
    }

    for number in numbers_list:
        try:
            res = send_whatsapp(to_number=number, poll=poll_payload)
            print(f"Sent to {number}: {res}")
        except Exception as e:
            print(f"Error sending to {number}: {e}")

        # Throttling delay: space out requests by 2 seconds
        time.sleep(2)

# Example usage:
# broadcast_poll_to_list(["9876543210", "+15551234567"], "Lunch today?", ["Pizza", "Burgers"])
```

---

## Message Delivery Logging

The Swift Project Gateway supports detailed logging to help you monitor and debug message delivery. Logs are categorized into two types:

### 1. Client-Side HTTP Responses

Every time your application calls the gateway API, it receives a detailed JSON response indicating the status:

- **Success (200 OK)**:
  ```json
  {
    "success": true,
    "recipient": "919876543210",
    "message": "WhatsApp message delivered successfully."
  }
  ```
- **Validation Failure (400 Bad Request)**:
  ```json
  {
    "success": false,
    "error": "Invalid phone number format: '123'. Normalization result '123' must contain 7 to 15 digits."
  }
  ```
- **Offline Client (503 Service Unavailable)**:
  ```json
  {
    "success": false,
    "error": "WhatsApp gateway client is not ready yet. Please scan the QR code at /qr."
  }
  ```
- **Delivery Error (500 Internal Server Error)**:
  ```json
  {
    "success": false,
    "error": "Failed to send WhatsApp message: <error details>"
  }
  ```

### 2. Server-Side Terminal Console Logs

The Node.js terminal window printing the gateway service logs will display activity in real time:

- **Request Received**:
  `[WhatsApp API Request] ➡️ Dispatching message to: 919876543210...`
- **Delivery Confirmation**:
  `[WhatsApp API Success] ✅ Message successfully delivered to: 919876543210`
- **Validation Rejections**:
  `[API Validation Failed]: Rejected request for '919876543210'. Missing required 'message' or 'to' field.`
- **Client Disconnections**:
  `[Connection Offline]: Cannot deliver to '919876543210'. WhatsApp client is disconnected.`
- **Fatal Dispatch Errors**:
  `[WhatsApp API Error] ❌ Failed to deliver to: 919876543210. Reason: <details>`

---

## Troubleshooting and FAQs

#### Q1: What does `503 Service Unavailable` mean?

This error is returned when the gateway API is hit but the WhatsApp client is not linked.

- **Fix**: Navigate to `http://localhost:3001/qr?token=YOUR_API_TOKEN` and scan the QR code to pair your device.

#### Q2: What does `400 Bad Request` mean?

This error means your payload has missing or malformed inputs. Common causes:

- The phone number has invalid formatting (less than 7 or more than 15 digits).
- The file size of the attachment or sticker exceeds the **maximum 200MB limit**.
- The request does not contain any message content (no text, attachment, poll, location, etc.).
- A sub-object is missing required properties (like a location object missing `latitude` or `longitude`).

#### Q3: How do I unlink a device or clear the authentication session?

To completely reset the gateway credentials:

1. Stop the Node service.
2. Delete the `.baileys_auth` folder in the root directory.
3. Restart the service using `npm start` to generate a fresh pairing QR code.

#### Q4: Why is it slow when I send messages in parallel?

The gateway will process requests as they arrive, but WhatsApp itself serializes message delivery. Trying to bypass delay loops on your client app will result in connection congestion and increases the risk of WhatsApp spam bans. Always use the recommended **1.5 to 3-second delay** in your loop.
