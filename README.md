# Standalone WhatsApp Gateway

An ultra-lightweight, self-hosted Node.js WhatsApp Gateway service built using `@whiskeysockets/baileys`. This standalone service allows you to send WhatsApp text broadcasts and rich media (images, PDFs, documents, audio, videos, and autoplaying GIFs) via simple REST APIs.

---

## 🚀 Setup & Execution

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create or modify the `.env` file in the root directory:
```env
PORT=3001

# (Optional) PostgreSQL database connection for 100% persistent auth sessions.
# If omitted, session state will save locally to the ".baileys_auth" folder.
# DATABASE_URL=postgresql://user:password@localhost:5432/dbname
```

### 3. Generate a Secure API Token
To protect the gateway from unauthorized abuse, you must generate a secure API token:
```bash
node generate-token.js
```
This script generates a secure 32-byte hex token, updates it in your `.env` file under `WHATSAPP_API_TOKEN`, and prints it out.

### 4. Start the Service
```bash
npm start
```

---

## 📲 Pairing (Device Linkage)

Once started, the gateway needs to be linked to a WhatsApp device:
1. The console will print a scan-friendly QR code.
2. Alternatively, open your browser and navigate to:
   `http://localhost:3001/qr?token=YOUR_API_TOKEN`
3. Open WhatsApp on your phone ➔ **Linked Devices** ➔ **Link a Device** ➔ Scan the QR Code.

---

## 🔐 Authentication Rules

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
   }
   ```

---

## 📡 API Reference

### 1. Check Gateway Status
* **Method:** `GET`
* **Endpoint:** `http://localhost:3001/`
* **Query Parameter:** `token=YOUR_API_TOKEN` (or bearer header)
* **Response (200 OK):**
  ```json
  {
    "status": "active",
    "ready": true,
    "authenticated": true,
    "qrWebUrl": "http://localhost:3001/qr?token=YOUR_API_TOKEN",
    "service": "In-House WhatsApp Ultra-Lightweight Gateway"
  }
  ```

### 2. Send Message / Media / Advanced Features
* **Method:** `POST`
* **Endpoint:** `http://localhost:3001/`
* **Headers:** `Content-Type: application/json` & `Authorization: Bearer YOUR_API_TOKEN`

#### Request Payload Schema

You must provide a recipient `to` (or `phone`), and at least one message content type: `message` (text), `attachment` (media), `location` (pin), `contact` (card), or `sticker` (webp).

##### A. Standard Text Message (with dynamic countryCode fallback)
```json
{
  "to": "5551234567",
  "countryCode": "1", // Optional. If omitted and number is 10 digits, prepends "91" (India).
  "message": "Hello!"
}
```

##### B. Document / Image / Video / Audio Attachment
```json
{
  "to": "+919876543210", 
  "message": "Text content or media caption",
  "attachment": {
    "fileName": "invoice.pdf",
    "contentType": "application/pdf",
    "contentBase64": "JVBERi0xLjQKJc..."
  }
}
```

##### C. Location Pin
```json
{
  "to": "+15551234567",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "name": "Headquarters",
    "address": "123 Tech Park Road, Bangalore, India"
  }
}
```

##### D. Contact Card (vCard)
```json
{
  "to": "+15551234567",
  "contact": {
    "fullName": "Jane Doe",
    "organization": "ACME Corp",
    "phone": "+1 555-987-6543"
  }
}
```

##### E. Sticker
```json
{
  "to": "+15551234567",
  "sticker": "UklGRiIAAABXRUJQVlA4..." // WebP file content in base64
}
```
*Note: Alternatively, send a standard attachment with `"isSticker": true` or `"contentType": "image/webp"`.*

#### Media Type Handling
The gateway dynamically determines how to deliver the attachment based on the `contentType` or `fileName` extension:
* **Images (`image/png`, `image/jpeg`):** Sent as inline-viewable images with direct previews.
* **Videos / GIFs (`video/mp4`, `image/gif`, or files ending in `.gif`):** Sent as inline-playable clips. If it's a GIF, it plays on an autoplay loop.
* **Audio (`audio/mpeg`, `audio/mp3`, `audio/ogg`):** Sent as native inline audio tracks.
* **Documents (`application/pdf`, `text/csv`, `.docx`, `.xlsx`):** Sent as standard downloadable documents.

---

## 💻 Integration Examples

Here is how you can programmatically call this gateway from other applications.

### 1. Node.js / TypeScript (Next.js)

Below is a complete helper function that formats 10-digit numbers, reads a local file, converts it to base64, and sends it:

```typescript
import fs from 'fs';
import path from 'path';

interface SendMessageOptions {
  to: string; // 10-digit number e.g. "9876543210" or full JID format
  message: string;
  attachmentPath?: string; // Optional path to a local file
  contentType?: string;    // e.g. "application/pdf"
}

export async function sendWhatsApp(options: SendMessageOptions) {
  const GATEWAY_URL = 'http://localhost:3001/';
  const API_TOKEN = 'YOUR_API_TOKEN';

  let attachment = undefined;

  // 1. Process local file to base64 if provided
  if (options.attachmentPath && fs.existsSync(options.attachmentPath)) {
    const fileBuffer = fs.readFileSync(options.attachmentPath);
    attachment = {
      fileName: path.basename(options.attachmentPath),
      contentType: options.contentType || 'application/octet-stream',
      contentBase64: fileBuffer.toString('base64'),
    };
  }

  // 2. Format phone number (prepending 91 country code for 10-digit inputs)
  let phone = options.to.replace(/\D/g, '');
  if (phone.length === 10) {
    phone = `91${phone}`;
  }

  // 3. Dispatch HTTP Post Request
  const response = await fetch(GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify({
      to: phone,
      message: options.message,
      attachment,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Failed to dispatch message');
  }

  return result;
}

// Example usage:
// sendWhatsApp({ to: '9876543210', message: 'Hello PDF!', attachmentPath: './invoice.pdf', contentType: 'application/pdf' });
```

### 2. Python

```python
import requests
import base64
import os

def send_whatsapp(to_number, message, file_path=None, content_type=None):
    gateway_url = "http://localhost:3001/"
    api_token = "YOUR_API_TOKEN"
    
    # Format phone number
    phone = "".join(filter(str.isdigit, to_number))
    if len(phone) == 10:
        phone = f"91{phone}"
        
    payload = {
        "to": phone,
        "message": message
    }
    
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
        "Authorization": f"Bearer {api_token}"
    }
    
    response = requests.post(gateway_url, json=payload, headers=headers)
    return response.json()

# Example usage:
# send_whatsapp("9876543210", "Python test message", "image.gif", "image/gif")
```

### 3. Bash / cURL

**Send Text Message:**
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "message": "Hello from Curl!"
  }'
```

**Send Document Attachment (e.g. sample.csv):**
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "message": "Here is your report",
    "attachment": {
      "fileName": "report.csv",
      "contentType": "text/csv",
      "contentBase64": "Y29sdW1uMSxjb2x1bW4yCmRhdGExLGRhdGEyCmRhdGEzLGRhdGE0"
    }
  }'
```
