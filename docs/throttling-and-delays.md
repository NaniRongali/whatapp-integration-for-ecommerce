# Built-in Throttling & In-Memory Queues (Anti-Ban Shield)

When sending WhatsApp messages, **sending messages too fast will get your WhatsApp number temporarily or permanently banned.** 

To eliminate integration complexity, **the Swift Project Gateway features an automated, built-in in-memory message queue with randomized delays.** 

---

## 1. How the Built-in Queue Works

1. **Instant Payload Validation**: When you hit the `POST /` endpoint, the gateway performs fast syntax, phone format, and size checks on your message. If it is invalid, it returns `400 Bad Request` or `500` immediately so you can handle the error.
2. **Acceptance and Enqueueing**: If the message is valid, the gateway registers it in memory, replies immediately with `200 OK` (with `"message": "Message queued successfully"`, and the `queuePosition`), and frees your client thread.
3. **Sequential Background Sending**: The gateway processes each session's queue independently in the background, sending one message at a time.
4. **Anti-Ban Throttling**: After each successful dispatch, the gateway pauses for a randomized delay between **2.0 and 4.0 seconds** to mimic human typing and protect the account from spam filters.
5. **Auto-Pause on Disconnect**: If the WhatsApp session loses connection, the background queue worker automatically pauses. Once the connection is re-established, the queue automatically resumes sending where it left off.

This completely removes the need to write complex sleep timers, loops, or queue packages in your own client application!

---

## 2. Implementations for Beginners

> [!NOTE]
> While you can still throttle manually in your own code using the loops below, it is **no longer required** since the gateway automatically serializes and rate-limits your dispatches behind the scenes.

Below are simple, complete code templates that you can copy-paste directly into your project if you want to orchestrate batch calls.

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
