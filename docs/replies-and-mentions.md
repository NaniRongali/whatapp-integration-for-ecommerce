# Sending Replies & Group Mentions

This guide explains how to reply to specific messages (quoted context) and tag/mention members inside group chats.

---

## 1. Replying to a Message (Quoted Reply)

To reply to a previous message (so that the user sees a quote of their message above your text), include the quoting parameters in your POST body:

```json
{
  "to": "+919876543210",
  "message": "This is my reply to your previous text",
  "quotedMessageId": "BAE5C1D8F82736C4",
  "quotedMessageText": "User: What is the price?",
  "quotedFromMe": false
}
```

### Quoting Parameters Reference:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`quotedMessageId`** | `String` | **Yes** | The unique ID of the message you are replying to (e.g. `"BAE5C1D8F82736C4"`). |
| **`quotedMessageText`** | `String` | Optional | A preview text string of the message you are replying to (displays inside the quote bubble). |
| **`quotedFromMe`** | `Boolean` | Optional | Set to `true` if you are replying to a message that the gateway itself sent earlier. <br>- *Default: `false`.* |

---

## 2. Tagging Group Members (Mentions)

In group chats (where `"to"` is a group JID ending in `@g.us`), you can mention members so they receive high-priority highlight notifications.

To tag members, include their phone numbers in the `mentions` array:

```json
{
  "to": "120363194883492749@g.us",
  "message": "Hey @15551234567 and @919876543210 please review this document.",
  "mentions": ["15551234567", "919876543210"]
}
```

### Mentions Schema Reference:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`mentions`** | `Array of Strings` | **Yes** | An array of phone numbers (e.g. `["15551234567", "919876543210"]`). The gateway automatically normalizes these into WhatsApp JIDs. |

> [!NOTE]
> Make sure to type `@<number>` inside the `message` text itself as well. The gateway will register the tap-action link for those numbers.

---

## 3. Integration Example (cURL)

```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "120363194883492749@g.us",
    "message": "Hello @919876543210",
    "mentions": ["919876543210"]
  }'
```
