# WhatsApp Throttling & Broadcast Loop Delays

When sending WhatsApp messages via this gateway, **sending messages too fast will get your WhatsApp number temporarily or permanently banned.** 

This guide explains the mechanisms behind WhatsApp's anti-spam detection and teaches you how to implement safe, rate-limited loops in your application.

---

## 1. Why is this necessary? (The Anti-Spam Rule)

Unlike email where you can send thousands of messages simultaneously, WhatsApp is a **real-time chat protocol**. 
WhatsApp's anti-spam algorithms monitor how quickly messages are sent from a single device. If you dispatch 100 messages within a few seconds, WhatsApp's servers will immediately detect this as bot behavior and flag/block your account.

To mimic human behavior and protect your WhatsApp number, you **must introduce a delay (spacing)** between every single message you send.

* **Recommended spacing**: **1.5 to 3 seconds** between individual messages.
* **Avoid Gateway-Side Queuing**: Managing the loop in the calling application is preferred because:
  1. **Status Visibility**: Your application gets instant feedback (`200 OK` or `500 Error`) for every recipient, allowing you to log delivery status in your database.
  2. **No Memory Bloat**: Storing hundreds of messages in a queue inside the gateway will cause RAM spikes.
  3. **No Message Loss**: If the gateway server restarts, any gateway-side queue is lost. By keeping the loop in the calling application, you prevent data loss.

---

## 2. Implementations for Beginners

Below are simple, complete code templates that you can copy-paste directly into your project.

### Node.js / JavaScript (async/await Loop)

If you are a beginner, note that a standard `.forEach` loop in JavaScript **does not wait** for asynchronous calls. You must use a `for...of` loop to execute requests sequentially with a delay.

```javascript
// 1. Define a helper function to pause execution
// This function returns a Promise that resolves after a specified number of milliseconds (ms)
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendBroadcast(recipientsList, messageContent) {
  const gatewayUrl = "http://localhost:3001/";
  const apiToken = "YOUR_API_TOKEN";

  console.log(`Starting broadcast to ${recipientsList.length} recipients...`);

  // 2. Use a "for...of" loop (sequentially waits for each iteration)
  for (let i = 0; i < recipientsList.length; i++) {
    const phone = recipientsList[i];
    
    console.log(`Sending to ${phone} (${i + 1}/${recipientsList.length})...`);

    try {
      // 3. Make the API request
      const response = await fetch(gatewayUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiToken}`
        },
        body: JSON.stringify({
          to: phone,
          message: messageContent
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        console.log(`✅ Success for ${phone}: Message sent.`);
        // [Optional]: Update your database here: db.updateStatus(phone, 'SENT')
      } else {
        console.error(`❌ Gateway rejected ${phone}: ${data.error}`);
        // [Optional]: Update your database here: db.updateStatus(phone, 'FAILED', data.error)
      }

    } catch (error) {
      console.error(`❌ Connection failed for ${phone}: ${error.message}`);
    }

    // 4. Rate limiting: Wait for 2 seconds (2000 milliseconds) before processing the next number
    // Do not run this on the very last message in the list
    if (i < recipientsList.length - 1) {
      console.log("Waiting 2 seconds to mimic human behavior...");
      await wait(2000); 
    }
  }

  console.log("Broadcast process finished.");
}

// --- HOW TO RUN IT ---
// const list = ["919876543210", "15551234567", "919999988888"];
// sendBroadcast(list, "Hello from Swift sync!");
```

---

### Python (time.sleep Loop)

In Python, rate limiting is very straightforward using the built-in `time` module.

```python
import time
import requests

def send_broadcast_with_delay(recipients_list, message_content):
    gateway_url = "http://localhost:3001/"
    api_token = "YOUR_API_TOKEN"
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_token}"
    }

    total_recipients = len(recipients_list)
    print(f"Starting broadcast to {total_recipients} recipients...")

    # Loop through the list index by index
    for index, phone in enumerate(recipients_list):
        print(f"Sending to {phone} ({index + 1}/{total_recipients})...")

        payload = {
            "to": phone,
            "message": message_content
        }

        try:
            # Send HTTP POST request
            response = requests.post(gateway_url, json=payload, headers=headers)
            result = response.json()

            if response.status_code == 200 and result.get("success"):
                print(f"✅ Success for {phone}: Message sent.")
            else:
                print(f"❌ Failed for {phone}: {result.get('error')}")

        except Exception as e:
            print(f"❌ Connection error for {phone}: {e}")

        # Throttling delay: Sleep for 2 seconds before the next loop iteration
        # Do not sleep after the last message is sent
        if index < total_recipients - 1:
            print("Sleeping for 2 seconds...")
            time.sleep(2)

    print("Broadcast finished.")

# --- HOW TO RUN IT ---
# list_numbers = ["919876543210", "15551234567"]
# send_broadcast_with_delay(list_numbers, "Hello from Python script!")
```
