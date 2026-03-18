/**
 * MIME types for audio recording in order of preference.
 * Safari (iOS/macOS) typically supports audio/mp4; Chrome supports audio/webm.
 */
const AUDIO_MIME_PRIORITY = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
  "audio/ogg",
];

/**
 * Returns the first MediaRecorder-supported audio MIME type for the current browser.
 * Use this so recording works on Safari, iOS, Android, and Chrome instead of only Chrome.
 */
export function getSupportedAudioMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "audio/webm";
  for (const mime of AUDIO_MIME_PRIORITY) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

/**
 * Returns a file extension for an audio Blob (e.g. for uploads).
 * Used so Safari-recorded audio (mp4) syncs with the correct extension.
 */
export function getAudioExtensionFromMime(mimeType: string): string {
  if (mimeType.includes("webm")) return "webm";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}
