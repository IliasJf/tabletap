import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

/** Absolute URLs for link previews come from the host serving the request. */
export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const title = "Olive & Ember — TableTap Café";
  const description =
    "Fresh plates, proper coffee, and slow mornings. Order from your table on WhatsApp.";
  return {
    metadataBase: host ? new URL(`${protocol}://${host}`) : undefined,
    title,
    description,
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: "/og.jpg", width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image" },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
