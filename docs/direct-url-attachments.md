# Sending Attachments via Direct Web URLs

This guide explains how to send stickers, images, videos, audio notes, and documents by passing a direct file Web URL (e.g. `https://example.com/invoice.pdf`) to the API.

---

## 1. Why use Direct URL Attachments?

* **No CPU overhead**: Your client application does not need to read bytes from the disk and convert them into massive Base64 strings.
* **Extremely Small Payload Size**: Instead of sending megabytes of Base64 text in the request body, you send a short JSON payload (only a few bytes) containing the URL.
* **Auto-Detection**: The gateway downloads the file in-memory, extracts the filename from the URL path, and determines the correct media formatting using HTTP headers—making parameters like `fileName` and `contentType` **completely optional**!

---

## 2. Request Payload Schema

To send an attachment via direct URL, replace `contentBase64` with the `url` property:

```json
{
  "to": "+919876543210",
  "message": "Verify this attached file",
  "attachment": {
    "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "fileName": "monthly-report.pdf", // Optional override
    "contentType": "application/pdf" // Optional override
  }
}
```

### Reference Fields:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`url`** | `String` | **Yes** | The direct public web URL of the file (e.g., `https://example.com/file.jpg`). |
| **`fileName`** | `String` | Optional | The filename. If omitted, the gateway extracts the filename from the URL pathname. |
| **`contentType`** | `String` | Optional | The MIME type. If omitted, the gateway checks the HTTP `Content-Type` header of the download. |

---

## 3. Direct URL Examples for All 5 Media Types

Below are the exact JSON payloads for all 5 supported media types:

### A. WebP Stickers (Direct URL)
Send the raw WebP URL directly inside the `"sticker"` property:
```json
{
  "to": "+919876543210",
  "sticker": "https://raw.githubusercontent.com/WhatsApp/stickers/master/Android/app/src/main/assets/1/01_Cuppy_smile.webp"
}
```

### B. Image Attachment (Direct URL)
```json
{
  "to": "+919876543210",
  "message": "Look at this grapefruit slice!",
  "attachment": {
    "url": "https://interactive-examples.mdn.mozilla.net/media/cc0-images/grapefruit-slice-332-332.jpg",
    "fileName": "grapefruit.jpg",
    "contentType": "image/jpeg"
  }
}
```

### C. Video / GIF Attachment (Direct URL)
```json
{
  "to": "+919876543210",
  "message": "A short video clip playback test",
  "attachment": {
    "url": "https://www.w3schools.com/html/mov_bbb.mp4",
    "fileName": "clip.mp4",
    "contentType": "video/mp4"
  }
}
```

### D. Audio Note Attachment (Direct URL)
```json
{
  "to": "+919876543210",
  "attachment": {
    "url": "https://www.w3schools.com/html/horse.mp3",
    "fileName": "sound.mp3",
    "contentType": "audio/mpeg"
  }
}
```

### E. Document / PDF Attachment (Direct URL)
```json
{
  "to": "+919876543210",
  "message": "Here is the PDF report document",
  "attachment": {
    "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    "fileName": "monthly-report.pdf",
    "contentType": "application/pdf"
  }
}
```

---

## 4. Co-Existence with Base64 Workflows (No Breaking Changes)

This feature does **not** replace the existing Base64 file paths workflow. The gateway detects which format is being sent dynamically:
* If the payload has `"contentBase64"`, it decodes the base64 text in-memory.
* If the payload has `"url"`, it fetches the remote file in-memory.

This ensures both methods work side-by-side, preserving backward compatibility with legacy client apps.

---

## 5. Supported Document Formats & MIME Types

The gateway supports sending virtually any document format via URL. When the `contentType` does not match an image, video, or audio, the gateway automatically dispatches it as a standard WhatsApp **Document** using the following MIME types:

* 📄 **PDF Documents**: `application/pdf` (`.pdf`)
* 📊 **Excel Spreadsheets**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (`.xlsx`), `application/vnd.ms-excel` (`.xls`)
* 📝 **Word Documents**: `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (`.docx`), `application/msword` (`.doc`)
* 📉 **PowerPoint Slides**: `application/vnd.openxmlformats-officedocument.presentationml.presentation` (`.pptx`), `application/vnd.ms-powerpoint` (`.ppt`)
* 📁 **CSV Sheets**: `text/csv` (`.csv`)
* 🗒️ **Plain Text / Log files**: `text/plain` (`.txt`, `.log`)
* ⚙️ **JSON Data**: `application/json` (`.json`)
* 📦 **ZIP/RAR Archives**: `application/zip` (`.zip`), `application/x-rar-compressed` (`.rar`)
* 💻 **Other extensions**: E.g. `.apk` (`application/vnd.android.package-archive`), `.exe` / `.bin` (`application/octet-stream`).

---

## 6. File Size Limits & Automated Optimization

The Swift Project Gateway enforces safety controls and performs automated optimization:
* **Max Payload Limit (200MB)**: The gateway will strictly reject any attachment file exceeding **200MB** with an HTTP `400 Bad Request` code to prevent server memory crashes.
* **Automated Image Optimization**: Images exceeding 1600px width/height are automatically scaled down and compressed at **80% JPEG/PNG quality** in-memory.
* **Automated Video Compression**: If system FFmpeg is available on the path, video uploads are automatically compressed (H.264 codec, CRF 28) to minimize mobile data consumption before dispatch.
* **Safe Fallbacks**: If optimization fails or FFmpeg is absent, the gateway safely falls back to sending the original uncompressed file buffer.
