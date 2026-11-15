import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * Browser-tab icon. Uses the Georgia Tech logo from public/brand/gt-logo.png on a white tile
 * when the file exists (generated at build time); otherwise the original navy wrench tile.
 */
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const file = join(process.cwd(), "public/brand/gt-logo.png");
  if (existsSync(file)) {
    const src = `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
    return new ImageResponse(
      (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#ffffff", borderRadius: 14 }}>
          <img src={src} alt="" style={{ width: 56, height: 56, objectFit: "contain" }} />
        </div>
      ),
      size,
    );
  }
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#003057", borderRadius: 14, color: "#B3A369", fontSize: 30, fontWeight: 800 }}>
        GT
      </div>
    ),
    size,
  );
}
