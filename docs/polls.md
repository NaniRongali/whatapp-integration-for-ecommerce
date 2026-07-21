# Sending Interactive Polls

This guide explains how to send native interactive polls where users can click to select options directly in the WhatsApp chat.

---

## 1. Request Payload Schema

To send a poll, add the `poll` object to your POST body:

```json
{
  "to": "+919876543210",
  "poll": {
    "name": "What is your shirt size?",
    "options": ["Small (S)", "Medium (M)", "Large (L)", "Extra Large (XL)"],
    "selectableCount": 1
  }
}
```

### Poll Schema Reference:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`name`** | `String` | **Yes** | The question text of the poll (e.g. `"What is your shirt size?"`). |
| **`options`** | `Array of Strings` | **Yes** | The voting options list. Must contain **at least 2 options**. |
| **`selectableCount`** | `Number` | Optional | Limits how many options a user can select: <br>- **`1`**: Single-choice (users see radio buttons). *(Default)* <br>- **`0` (or more)**: Multi-choice (users see checkboxes). |

---

## 2. Integration Example (cURL)

```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "poll": {
      "name": "Select your team role:",
      "options": ["Developer", "Designer", "Manager", "QA"],
      "selectableCount": 1
    }
  }'
```

---

## 3. How the Poll Renders to the User
* Recipients see a clean card with buttons for each option.
* Once they click an option, their vote is sent back to the sender.
* The poll card displays real-time vote tallies in the chat.
