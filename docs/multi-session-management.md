# Multi-Session Management Guide

The Swift Project Gateway supports running and managing multiple independent WhatsApp accounts simultaneously from a single server instance. This guide details how to create, pair, query, and message separate sessions.

---

## 1. How Session Isolation Works

* **PostgreSQL Database**: Sockets store encryption keys, tokens, and active credentials in a shared `whatsapp_session` table with a composite key of `(session_id, key)`. This isolates each number's connection details.
* **Local Auth Directory Fallback**: Sockets save connection parameters locally under `.baileys_auth_${session_id}` directories.
* **Auto-Reload**: When the gateway server boots, it automatically queries the database (or scans local directories) to discover all existing sessions and starts their connections immediately. No manual trigger is required!

---

## 2. API Endpoints for Session Management

### A. List All Active Sessions
Retrieve a summary of all sessions loaded in-memory and their connection status:
* **Route**: `GET /sessions`
* **Query Parameters**: `token` (Optional, if API Token protection is enabled)
* **Response**:
  ```json
  {
    "success": true,
    "sessions": [
      { "id": "default", "status": "CONNECTED", "phone": "917013491407" },
      { "id": "sales", "status": "PENDING_SCAN", "phone": null },
      { "id": "hr", "status": "INITIALIZING", "phone": null }
    ]
  }
  ```

### B. View Session Status
Get detailed connection information for a specific session:
* **Route**: `GET /status`
* **Query Parameters**:
  * `session` (e.g. `sriram`, defaults to `default`)
  * `token` (Optional)
* **Response**:
  ```json
  {
    "success": true,
    "session": "sriram",
    "status": "CONNECTED",
    "phone": "917013491407"
  }
  ```

### C. Link a New Device (Generate QR Code)
Initialize a new session and display its pairing QR code:
* **Route**: `GET /qr`
* **Query Parameters**:
  * `session` (Provide a new or existing session name, e.g. `?session=finance`)
  * `token` (Optional)
* **Behavior**: If the session ID does not exist, the gateway automatically registers and boots it up in-memory, generating a fresh QR code immediately.

### D. Log Out & Delete Session
Remotely unlink the session device, close its socket connection, and delete the associated credentials database rows or folder. This can be triggered either via a REST call or directly inside a web browser URL link:
* **Standard API Route**: `DELETE /sessions`
* **Browser-Friendly Route**: `GET /sessions/delete`
* **Query Parameters**:
  * `session` (Required, e.g. `?session=sales`)
  * `token` (Optional)
* **Response**:
  ```json
  {
    "success": true,
    "message": "Session 'sales' successfully logged out and deleted."
  }
  ```

---

## 3. Directing Messages to a Specific Session

To send a message from a specific linked WhatsApp account, pass the `session` parameter in your `POST /` request body or query string.

### Request Payload Example:
```json
{
  "session": "sales",
  "to": "+919876543210",
  "message": "Hello from the sales account!"
}
```

### Response Example:
The server immediately validates inputs and responds with a successful queuing status:
```json
{
  "success": true,
  "recipient": "919876543210",
  "message": "Message queued successfully.",
  "queuePosition": 1
}
```

*If you omit the `"session"` property, the gateway defaults to the `"default"` session to maintain complete backward compatibility.*

---

## 4. Route Summary Quick Reference

Below are the exact request URLs for quick testing and integration:

* **List All Sessions**:
  ```http
  GET http://localhost:3001/sessions?token=YOUR_API_TOKEN
  ```

* **Get Session Status**:
  ```http
  GET http://localhost:3001/status?token=YOUR_API_TOKEN&session=YOUR_SESSION_NAME
  ```

* **Link Device / View QR Page**:
  ```http
  GET http://localhost:3001/qr?token=YOUR_API_TOKEN&session=YOUR_SESSION_NAME
  ```

* **Remote Logout & Delete Session**:
  * **API REST Call**:
    ```http
    DELETE http://localhost:3001/sessions?token=YOUR_API_TOKEN&session=YOUR_SESSION_NAME
    ```
  * **Direct Browser URL Click**:
    ```http
    GET http://localhost:3001/sessions/delete?token=YOUR_API_TOKEN&session=YOUR_SESSION_NAME
    ```
