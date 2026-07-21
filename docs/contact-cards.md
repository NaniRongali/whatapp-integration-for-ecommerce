# Sending Contact Cards (vCards)

This guide explains how to share contact cards (vCards) directly inside WhatsApp. You can share a single contact card or a bundle of multiple contact cards.

---

## 1. Sharing a Single Contact Card

To share one contact, use the `contact` object in your POST body:

```json
{
  "to": "+919876543210",
  "contact": {
    "fullName": "Jane Doe",
    "organization": "ACME Corp",
    "phone": "+1 555-123-4567"
  }
}
```

### Single Contact Schema:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`fullName`** | `String` | **Yes** | The name displayed on the contact card. |
| **`organization`** | `String` | Optional | The name of the company or department. |
| **`phone`** | `String` | **Yes** | The contact's phone number. Cleaned and linked automatically. |

---

## 2. Sharing Multiple Contact Cards (Bulk Contacts)

To send multiple cards in a single message (e.g. sharing the contact details of a support team), use the `contactsList` array:

```json
{
  "to": "+919876543210",
  "contactsDisplayName": "Sales Department Contacts",
  "contactsList": [
    { "fullName": "Jane Doe", "organization": "HR Dept", "phone": "+1 555-123-4567" },
    { "fullName": "John Smith", "organization": "Finance Dept", "phone": "+91 98765 43210" }
  ]
}
```

### Bulk Contact Schema:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`contactsDisplayName`** | `String` | Optional | The name of the bundle display message (e.g., `"Shared Contacts List"`). |
| **`contactsList`** | `Array` | **Yes** | A list of contact objects, where each object requires a `fullName` and `phone`. |

---

## 3. How vCard Generation Works (Technical Detail)

WhatsApp expects contact cards formatted as standard vCard (v3.0) strings. Under the hood, the gateway automatically compiles your contact parameters into the following compliant structure:

```vcard
BEGIN:VCARD
VERSION:3.0
FN:Jane Doe
ORG:ACME Corp;
TEL;type=CELL;type=VOICE;waid=15551234567:+1 555-123-4567
END:VCARD
```

* **`waid` (WhatsApp ID)**: The gateway extracts and cleans the phone number (removing brackets/signs) to create the `waid` parameter. This adds the quick **"Message"** button directly onto the card in the recipient's WhatsApp interface, letting them text that contact in one click.

---

## 4. Integration Example (cURL)

```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "contact": {
      "fullName": "Jeff Bezos",
      "organization": "Amazon",
      "phone": "+1 206-266-1000"
    }
  }'
```
