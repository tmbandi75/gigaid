// Rewrites Markdown image embeds that point at `support-media/*.gif` clips
// into inline HTML <video> elements that play the matching `.mp4`.
//
// The on-disk support manual (`attached_assets/support-manual.md`) embeds each
// demo clip as a GIF so it works on every Markdown-only surface (in-app help,
// email digests, GitHub previews). The published support site, however, can
// render raw HTML — so we swap each GIF embed for a sharper, smaller MP4 via
// a `<video autoplay muted loop playsinline>` element. The GIF is reused as
// the `poster` (and as the inner `<img>` fallback) so browsers that block
// autoplay still show an animated preview, and very old browsers without
// `<video>` support fall through to the original GIF.

const GIF_EMBED_PATTERN = /!\[([^\]]*)\]\((support-media\/[A-Za-z0-9_\-]+)\.gif\)/g;

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function rewriteSupportMediaGifsToVideo(markdown: string): string {
  return markdown.replace(GIF_EMBED_PATTERN, (_match, rawAlt: string, basePath: string) => {
    const alt = escapeHtmlAttr(rawAlt);
    const gifSrc = `${basePath}.gif`;
    const mp4Src = `${basePath}.mp4`;
    // Wrapped in blank-line-friendly HTML so Markdown processors treat it as
    // a raw HTML block. `style` keeps the embed responsive without depending
    // on the host site's CSS.
    return [
      `<video autoplay muted loop playsinline preload="metadata" poster="${gifSrc}" aria-label="${alt}" style="display:block;max-width:100%;height:auto;">`,
      `  <source src="${mp4Src}" type="video/mp4">`,
      `  <img src="${gifSrc}" alt="${alt}" style="display:block;max-width:100%;height:auto;">`,
      `</video>`,
    ].join("\n");
  });
}
