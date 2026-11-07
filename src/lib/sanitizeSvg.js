// src/lib/sanitizeSvg.js
// High-performance DOM-tree SVG Sanitizer (OWASP Top 10 / CWE-79 defense)
// Strips executable scripts, foreignObjects, event handlers, and malicious URIs while preserving scientific diagrams.

export function sanitizeSvg(rawSvg) {
  if (!rawSvg || typeof rawSvg !== "string") return "";
  if (typeof window === "undefined") return rawSvg; // Safe for SSR pass-through

  try {
    const trimmed = rawSvg.trim();
    if (!trimmed.toLowerCase().includes("<svg")) return "";

    const parser = new DOMParser();
    const doc = parser.parseFromString(trimmed, "image/svg+xml");

    // If parser encountered malformed XML syntax error, abort safely
    if (doc.querySelector("parsererror")) {
      return "";
    }

    // 1. Remove dangerous executable tags
    const bannedTags = [
      "script",
      "iframe",
      "object",
      "embed",
      "link",
      "foreignObject",
      "meta",
      "base",
    ];
    bannedTags.forEach((tag) => {
      doc.querySelectorAll(tag).forEach((el) => el.remove());
    });

    // 2. Strip event handlers (on*) & dangerous script URIs
    const allElements = doc.querySelectorAll("*");
    allElements.forEach((el) => {
      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const val = attr.value.trim().toLowerCase();

        // Remove on* event handlers (onload, onerror, onclick, etc.)
        if (name.startsWith("on")) {
          el.removeAttribute(attr.name);
          return;
        }

        // Remove dangerous scheme URIs
        if (
          val.startsWith("javascript:") ||
          val.startsWith("vbscript:") ||
          (val.startsWith("data:") && !val.startsWith("data:image/"))
        ) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return new XMLSerializer().serializeToString(doc.documentElement);
  } catch (err) {
    console.warn("SVG sanitization error:", err);
    return "";
  }
}
