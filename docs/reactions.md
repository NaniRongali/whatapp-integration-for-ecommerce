# Sending Message Reactions

This guide explains how to add, update, or remove emoji reactions (like 👍, ❤️, 😂, 🔥) on existing WhatsApp messages.

---

## 1. Request Payload Schema

To react to a message, add the `reaction` object to your POST body:

```json
{
  "to": "+919876543210",
  "reaction": {
    "emoji": "🔥",
    "messageId": "BAE5C1D8F82736C4",
    "fromMe": false
  }
}
```

### Reaction Schema Reference:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`emoji`** | `String` | **Yes** | The emoji character to react with (e.g. `"👍"`, `"❤️"`, `"🎉"`). <br>- *Pass an empty string `""` to remove a reaction.* |
| **`messageId`** | `String` | **Yes** | The unique ID of the message you want to react to (e.g. `"BAE5C1D8F82736C4"`). |
| **`fromMe`** | `Boolean` | Optional | Indicates if the target message was sent by the gateway (`true`) or received from the client (`false`). <br>- *Default: `false`.* |

---

## 2. How to Retrieve the `messageId`
A message ID is the unique identifier for every message. You can find it:
1. **When Sending Messages**: When you call the POST endpoint to send a message, the gateway responds with the message JID and details, or you can check console logs.
2. **From WhatsApp Webhooks / Events**: If you build a listener, every incoming message object received has a `key.id` property representing the `messageId`.

---

## 3. Integration Examples

### React with Emoji (cURL)
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "reaction": {
      "emoji": "👍",
      "messageId": "BAE5C1D8F82736C4"
    }
  }'
```

### Remove a Reaction (cURL)
To delete a reaction you placed earlier, react again using an empty string `""` for the emoji:
```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "reaction": {
      "emoji": "",
      "messageId": "BAE5C1D8F82736C4"
    }
  }'
```
