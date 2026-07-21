# Sending Location Pins

This guide explains how to send interactive map locations / pin drops via the WhatsApp Gateway API.

---

## 1. Request Payload Schema

To send a location pin, send a POST request with a `location` object in the JSON body:

```json
{
  "to": "+919876543210",
  "location": {
    "latitude": 12.9716,
    "longitude": 77.5946,
    "name": "Central Office",
    "address": "123 Tech Park Road, Sector 4, Bangalore, India"
  }
}
```

### Location Schema Reference:

| Field Name | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| **`latitude`** | `Number` | **Yes** | The geographic latitude coordinates (e.g. `12.9716`). |
| **`longitude`** | `Number` | **Yes** | The geographic longitude coordinates (e.g. `77.5946`). |
| **`name`** | `String` | Optional | The title of the location displayed in bold on the map preview (e.g., `"Central Office"`). |
| **`address`** | `String` | Optional | A subtitle explaining the physical address details (e.g., `"123 Tech Park Road..."`). |

---

## 2. Integration Example (cURL)

```bash
curl -X POST http://localhost:3001/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -d '{
    "to": "9876543210",
    "location": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "name": "San Francisco",
      "address": "California, United States"
    }
  }'
```

---

## 3. How it looks to the Recipient
When this payload is sent:
1. The recipient receives a native WhatsApp location message card.
2. Clicking on the card opens Google Maps or Apple Maps directly to the specified coordinates.
3. The custom `name` and `address` values will be displayed at the bottom of the map card preview.
