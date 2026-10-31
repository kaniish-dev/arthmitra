import { ImageResponse } from "next/og";

/** Home-screen icon for iOS and the PWA (PNG), drawn like icon.svg. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "linear-gradient(135deg, #1a73e8, #0842a0)" }}>
        <svg width="180" height="180" viewBox="0 0 512 512">
          <g fill="none" stroke="#fff" strokeWidth="36" strokeLinecap="round" strokeLinejoin="round">
            <path d="M160 146H336" />
            <path d="M160 212H336" />
            <path d="M196 146h38c52 0 80 30 80 66s-28 66-80 66h-38l118 112" />
          </g>
          <g fill="none" stroke="#6dd58c" strokeWidth="26" strokeLinecap="round" strokeLinejoin="round">
            <path d="M350 376l46-46" />
            <path d="M366 330h30v30" />
          </g>
        </svg>
      </div>
    ),
    size,
  );
}
