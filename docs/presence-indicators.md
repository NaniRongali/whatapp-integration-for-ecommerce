# Sending Presence Indicators

This guide explains how to toggle typing and recording presence states in WhatsApp chat.

---

## 1. Request Payload Schema

To trigger a presence update, send a POST request with the `presence` string in your JSON body:

```json
{
  "to": "+919876543210",
  "presence": "composing"
}
```

### Presence Parameters Reference:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`presence`** | `String` | **Yes** | The state to send. Must be one of the following exact string values: <br>- **`"composing"`**: Shows **"typing..."** in the recipient's header. <br>- **`"recording"`**: Shows **"recording audio..."** in the recipient's header. <br>- **`"paused"`**: Stops showing any status indicator. <br>- **`"available"`**: Updates status to online. <br>- **`"unavailable"`**: Updates status to offline. |

---

## 2. Integration Example (cURL)

```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "presence": "recording"
  }'
```

---

## 3. Best Practice: Simulating Human Typing
To make your gateway look like a human agent typing, send a `"composing"` presence payload 2-3 seconds **before** sending the actual text message:

1. **Step 1**: Send `POST /` with `"presence": "composing"`.
2. **Step 2**: Pause your application execution for 2 seconds.
3. **Step 3**: Send `POST /` with the text message `"message": "Here is the response details"`.
4. **Step 4 (Optional)**: Send `POST /` with `"presence": "paused"`.
