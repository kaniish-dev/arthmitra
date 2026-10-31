/**
 * Short random id. crypto.randomUUID() exists only in secure contexts (HTTPS or localhost), so
 * on the dev server's LAN address (http://192.168.x.x) it is undefined; getRandomValues works
 * everywhere.
 */
export function shortId(length = 8): string {
  const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").slice(0, length);
}

/**
 * Copies text. navigator.clipboard is also secure-context only, so on a LAN address this falls
 * back to the older copy command. Returns false when neither works.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Blocked: try the fallback.
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
