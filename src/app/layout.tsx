import type { Metadata, Viewport } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const sans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Eligibility Integration Broker (demo)",
  openGraph: {
    title: "Eligibility Integration Broker (demo)",
    description: "An independent portfolio demo of an integration layer between a modern front end and older eligibility systems. All data is made up.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Eligibility Integration Broker (demo)",
    description: "Token check, validation, REST and SOAP services, XML to JSON transform and a hash-chained audit log. All data is made up.",
  },
  icons: { icon: `${process.env.PAGES_BASE_PATH ?? ""}/favicon.svg` },
  description:
    "An independent portfolio demo of an integration layer: OAuth 2.0 token check, request validation, a REST income service, a SOAP eligibility service, an XML to JSON transform and a hash-chained audit log.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body>
        <a href="#main" className="skip-link">
          Skip to the demo
        </a>
        <div className="banner" role="note" aria-label="Disclaimer">
          <strong>Independent portfolio demo by Jake Worsham.</strong> Not affiliated with or endorsed by the State of Michigan or MDHHS. All people and data are made up. This is not a benefits decision.
        </div>
        {children}
      </body>
    </html>
  );
}
