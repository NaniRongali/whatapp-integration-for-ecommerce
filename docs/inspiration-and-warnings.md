# Inspiration, Warnings & Meta Alternatives

This document details the purpose of this project, account safety guidelines, and how it compares to official Meta WhatsApp options.

---

## 1. Project Inspiration (Why We Built This)

Official WhatsApp solutions (like the Meta WhatsApp Cloud API) can be expensive, restrictive, and complex to set up. We created this lightweight, self-hosted gateway to provide:
* **Zero Cost**: Send unlimited messages without paying Meta's per-conversation template fees.
* **Ultimate Flexibility**: Send dynamic interactive features like polls, emoji reactions, presence composing indicators, and WebP stickers—many of which are restricted or hard to implement on the official API.
* **Stateless Simplicity**: An easy JSON HTTP POST endpoint that parses numbers and handles media in-memory without database overhead.

---

## 2. ⚠️ Critical Warning: Account Ban Risks (Spam Bot Detection)

Because this gateway connects using WhatsApp Web protocols (under the hood via `@whiskeysockets/baileys`), **WhatsApp treats your connected phone number as a web client, not an API.** 

If you use this gateway excessively or poorly, **WhatsApp's automated security systems will block and ban your number as a spam bot.**

### High-Risk Actions that Trigger Bans:
1. **No Loop Delays**: Sending messages to multiple numbers instantly in a tight loop. Always use the recommended **1.5 to 3-second delay** in your loop.
2. **Cold Numbers**: Linking a brand-new SIM card/number and immediately broadcasting to 500 contacts. Numbers must be "warmed up" by having organic two-way conversations first.
3. **Unsolicited Messaging**: Sending bulk messages to people who do not have your number saved in their contacts. If multiple users click **"Report Spam"** or **"Block"** on your number, WhatsApp will ban you instantly.
4. **Massive Daily Volumes**: Sending thousands of promotional messages per day on standard personal/business accounts.

> [!WARNING]
> **Use at Your Own Risk**: This self-hosted gateway is designed for transactional updates (like sending salary slips, OTPs, or notifications to employees/customers who expect them). Excessive promotional spamming *will* result in your number being blocked. The developers of this gateway are not responsible for banned accounts.

---

## 3. The Alternative: Official Meta WhatsApp Business Platform

If your business requires sending **large volumes of daily messages (e.g. 5,000+ messages/day)** to cold leads or you cannot afford any risk of number blockage, you should migrate to the **Official Meta WhatsApp Cloud API**.

### Comparison:

| Feature | **This Gateway (Self-Hosted)** | **Official Meta Business API** |
| :--- | :--- | :--- |
| **Meta Message Fees** | 🆓 **$0** (100% Free) | 💰 **Paid** (Charges per conversation template) |
| **Spam Blocking Risk** | ⚠️ **High** (If misused or reported) | 🛡️ **Zero** (Approved templates are compliant) |
| **Number Warm-up** | Required manually | Not required |
| **Setup Complexity** | Easy (Link via QR Code in 2 minutes) | Complex (Requires Meta Business Manager, verified company docs, and template approval) |
| **Advanced Media/Polls** | Built-in out-of-the-box | Highly restricted / template-only |

### Recommendation:
* Use **this Gateway** if you are sending transactional messages, reminders, or updates to users who already know you and have opted-in (like employees, active clients, or students).
* Use the **Meta Business API** if you are running large-scale automated marketing campaigns to new leads.
