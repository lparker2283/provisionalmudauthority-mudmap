import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { EB_Garamond, Oswald, Special_Elite } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "leaflet/dist/leaflet.css";
import "./globals.css";

const oswald = Oswald({ subsets: ["latin"], variable: "--font-heading", display: "swap" });
const garamond = EB_Garamond({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const specialElite = Special_Elite({ subsets: ["latin"], weight: "400", variable: "--font-form", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL("https://map.provisionalmudauthority.com"),
  title: {
    default: "Register of Active Excavations · Rochester, NY",
    template: "%s · Register of Active Excavations",
  },
  description:
    "A free, community-kept map of construction sites around Rochester, NY where families can safely stop and watch the diggers.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F5F0E6",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${garamond.variable} ${specialElite.variable}`}>
      <body>
        <header className="site-header">
          <Link href="/" className="site-title">
            <span className="form-no">Form PMA-311</span>
            <span className="site-name">Register of Active Excavations</span>
          </Link>
          <nav className="site-nav" aria-label="Main">
            <Link href="/">Map</Link>
            <Link href="/about">About</Link>
            <Link href="/add" className="nav-cta">Add a site</Link>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          A project of the Provisional Mud Authority, built by Lindsey Parker, a parent in Rochester.
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
