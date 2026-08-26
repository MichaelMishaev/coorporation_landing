import type { Metadata } from "next";
import { Noto_Sans_Hebrew } from "next/font/google";
import "./globals.css";

const notoSansHebrew = Noto_Sans_Hebrew({
  subsets: ["hebrew"],
  weight: ["400", "600", "700"],
  display: "swap",
  variable: "--font-hebrew",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.org";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "עמך ישראל",
  description: "הצטרפו אלינו ותנו לנו את הכח להילחם למענכם",
  openGraph: {
    title: "עמך ישראל",
    description: "הצטרפו אלינו ותנו לנו את הכח להילחם למענכם",
    images: ["/og-image.jpg"],
    locale: "he_IL",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" className={notoSansHebrew.variable}>
      <body>{children}</body>
    </html>
  );
}
