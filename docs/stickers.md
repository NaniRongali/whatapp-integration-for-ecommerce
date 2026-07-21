# Sending Stickers

This guide explains how to send custom WhatsApp stickers.

---

## 1. Requirements for Stickers

WhatsApp enforces a strict format for stickers:
1. **File Format**: Must be **WebP** (`image/webp` MIME type).
2. **Dimensions**: Must be exactly **512 x 512 pixels**.
3. **Transparency**: Transparency is supported and recommended for a professional look.

---

## 2. Request Payload Schema

You can send a sticker in two ways:

### Method A: Direct Sticker Parameter (Recommended)
Pass a Base64-encoded WebP image string directly to the `sticker` field:

```json
{
  "to": "+919876543210",
  "sticker": "UklGRiIAAABXRUJQVlA4..." // WebP file content in base64
}
```

### Method B: Via Standard Attachment
Send the WebP file inside the standard `attachment` object, setting either `isSticker: true` or utilizing `image/webp` contentType:

```json
{
  "to": "+919876543210",
  "attachment": {
    "fileName": "logo-sticker.webp",
    "contentType": "image/webp",
    "contentBase64": "UklGRiIAAABXRUJQVlA4...",
    "isSticker": true
  }
}
```

---

## 3. Integration Example (cURL)

```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "sticker": "UklGRiIAAABXRUJQVlA4WY0AA..."
  }'
```
