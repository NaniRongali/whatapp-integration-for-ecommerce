# Sending Text Messages

This guide explains how to send standard WhatsApp text messages to global numbers.

---

## 1. Request Payload Schema

To send a text message, send an HTTP `POST` request to `http://localhost:3001/` with the following JSON structure:

```json
{
  "to": "5551234567",
  "countryCode": "1",
  "message": "Hello! This is a standard text message."
}
```

### Key Reference Table:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`to`** (or `phone`) | `String` | **Yes** | Target recipient's phone number. Can include spaces, brackets, dashes, or `+` (e.g. `+1 (555) 123-4567`). |
| **`countryCode`** | `String` | Optional | Custom country code (without `+`) to prepend to the phone number. (e.g. `1` for US, `44` for UK, `91` for India). |
| **`message`** (or `body`) | `String` | **Yes** | The text content of the message you want to deliver. |

---

## 2. Under the Hood: Phone Number Cleaning & Fallbacks

A beginner-friendly breakdown of how the gateway processes the `"to"` number:

1. **Cleaning**: The gateway strips all spaces, letters, brackets, and signs.
   - Input: `+1 (555) 123-4567` $\rightarrow$ Cleaned: `15551234567`.
2. **Dynamic prepend (`countryCode`)**: If you pass `"countryCode": "1"`, the gateway ensures the cleaned number starts with `1`.
   - Input: `"to": "5551234567", "countryCode": "1"` $\rightarrow$ Cleaned: `15551234567`.
3. **Legacy Prepend Fallback**: If you do not specify a `countryCode` and the cleaned phone number is **exactly 10 digits**, the gateway automatically prepends the default country code from your `.env` file (which defaults to `91` for India).
   - Input: `"to": "9876543210"` $\rightarrow$ Cleaned: `919876543210`.
4. **Length Check**: After cleaning, the number must contain **between 7 and 15 digits** (standard international number length). If it is too short (like `123`), the gateway immediately rejects it with a `400 Bad Request` validation error.

---

## 3. Integration Examples

### Bash / cURL
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "+919876543210",
    "message": "Hello from the console command line!"
  }'
```

### Node.js / JavaScript
```javascript
async function sendText() {
  const response = await fetch("http://localhost:3001/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer YOUR_API_TOKEN"
    },
    body: JSON.stringify({
      to: "5551234567",
      countryCode: "1",
      message: "Hello world!"
    })
  });
  
  const result = await response.json();
  console.log(result);
}
```
