# Automated Media Optimization & File Limits

The Swift Project Gateway features an automated media processing pipeline to optimize bandwidth, speed up message transmission, and enforce payload safety limits.

---

## 1. Payload Size Limitation (200MB limit)

To prevent server out-of-memory crashes (Heap Allocation limits) and maintain network connection quality:
* **The Rule**: The gateway rejects any request where the attachment file size (decoded from Base64 or downloaded from a URL) exceeds **200MB** (`209,715,200` bytes).
* **The Response**: If the limit is exceeded, the server returns an HTTP `400 Bad Request` status:
  ```json
  {
    "success": false,
    "error": "File size exceeds the maximum limit of 200MB."
  }
  ```

---

## 2. Automated Image Optimization

When an image (JPEG, PNG, BMP, or TIFF) is received (GIF and WebP are skipped to preserve animation frames), the gateway automatically optimizes it using the built-in `jimp` processor:

* **Dimensions Constraint**: If the image width or height exceeds `1600px`, it is resized to a maximum of `1600px` (maintaining original aspect ratio).
* **Quality Reduction**: Re-encodes the image at **80% JPEG/PNG quality**, significantly reducing file sizes with virtually zero visible loss.
* **Safe Fallback**: If processing fails (e.g. corrupt image stream), the gateway prints a console warning and **automatically falls back to sending your original uncompressed image buffer**, ensuring the message is still delivered.

---

## 3. Automated Video Compression (FFmpeg)

When a video file (MP4/MOV/etc.) is received, the gateway dynamically checks the system PATH for the **FFmpeg** encoding engine:

* **FFmpeg Not Installed**: The gateway logs a console warning and sends the original raw video buffer directly.
* **FFmpeg Installed**: The gateway writes the video to a temp folder, compresses it using the highly efficient **H.264** video codec, and reads the compressed file:
  * **Video Codec**: `libx264` (universal compatibility)
  * **Constant Rate Factor (CRF)**: `28` (optimal compression-to-quality ratio for mobile screens)
  * **Audio Codec**: `AAC` stereo at `128k` bitrate
  * **Speed Preset**: `superfast`
  * **Cleanup**: All temporary files are safely deleted immediately after processing is completed or fails.
* **Safe Fallback**: If the FFmpeg command encounters an error, the gateway automatically falls back to sending the **original video buffer**.
