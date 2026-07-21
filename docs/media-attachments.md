# Sending Media & File Attachments (Base64)

This guide explains how to send images, videos, audio clips, and documents (like PDFs or CSVs) over the WhatsApp Gateway API.

---

## 1. Core Workflow: Stateless & In-Memory

To make this API fully stateless, **you do not send file paths (like `C:/files/invoice.pdf`) to the API.** 

If you sent a file path, the gateway would only be able to find the file if it was running on the exact same computer and had permission to read your folder. Instead:
1. **Your Client App** reads the file from its local disk.
2. **Your Client App** converts the file bytes into a **Base64 text string**.
3. **Your Client App** sends this Base64 string in the API request body.
4. **The Gateway** converts the Base64 text string back into file bytes in RAM (in-memory) and sends it directly to WhatsApp's servers.

This allows you to host the gateway in Docker, or on a remote cloud server, and still send files from any local computer seamlessly.

---

## 2. Request Payload Schema

To send an attachment, add the `attachment` object to your HTTP `POST` body:

```json
{
  "to": "+919876543210",
  "message": "Here is the invoice report",
  "attachment": {
    "fileName": "invoice.pdf",
    "contentType": "application/pdf",
    "contentBase64": "JVBERi0xLjQKJc..."
  }
}
```

### Attachment Schema Reference:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`fileName`** | `String` | **Yes** | The name of the file (e.g. `invoice.pdf`, `photo.jpg`). Must include the extension. |
| **`contentType`** | `String` | **Yes** | The MIME type of the file (e.g. `application/pdf`, `image/png`, `video/mp4`, `audio/mpeg`). |
| **`contentBase64`** | `String` | **Yes** | The complete raw content of the file encoded as a Base64 string. |

---

## 3. Media Type Auto-Detection

The gateway automatically checks the `contentType` or file extension to decide how to show the file to the recipient:

* **Images (`image/png`, `image/jpeg`)**: Displayed as an **inline image preview** directly inside the chat window.
* **Videos / GIFs (`video/mp4`, `image/gif`)**: Displayed as an **inline-playable video player**. If it's a `.gif` file, it autoplay-loops silently like a standard GIF.
* **Audio (`audio/mpeg`, `audio/mp3`, `audio/ogg`)**: Displayed as a **voice-note player / audio track player** that the user can press play on.
* **Documents (Anything else: PDF, CSV, Excel, Word, Zip)**: Displayed as a **downloadable file attachment** showing the file name and size.

---

## 4. How to Encode Files to Base64 (Code Examples)

### Node.js / JavaScript
```javascript
const fs = require("fs");
const path = require("path");

function getBase64Payload(localPath) {
  // 1. Read the raw file bytes
  const fileBuffer = fs.readFileSync(localPath);
  
  // 2. Convert bytes to base64 string
  const base64String = fileBuffer.toString("base64");
  
  // 3. Construct the API object
  return {
    fileName: path.basename(localPath),
    contentType: "application/pdf", // Replace with appropriate MIME type
    contentBase64: base64String
  };
}
```

### Python
```python
import base64
import os

def get_base64_payload(local_path):
    # 1. Read the raw file bytes
    with open(local_path, "rb") as f:
        file_bytes = f.read()
    
    # 2. Encode to Base64 bytes, then decode to UTF-8 text string
    base64_string = base64.b64encode(file_bytes).decode("utf-8")
    
    # 3. Construct the API object
    return {
        "fileName": os.path.basename(local_path),
        "contentType": "application/pdf", # Replace with appropriate MIME type
        "contentBase64": base64_string
    }
```

---

## 5. File Size Limits & Recommendations
WhatsApp imposes strict limits on file sizes sent via their protocol:
* **Images, Videos, and Voice Messages**: Max **16 MB**.
* **Documents (PDF, spreadsheets, etc.)**: Max **100 MB**.

For optimal gateway performance and to avoid memory overload, we recommend keeping files under **15 MB** whenever possible.
