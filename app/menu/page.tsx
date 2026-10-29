import type { Metadata } from "next";
import Restaurant from "../components/Restaurant";
import { readPublicCatalog } from "../../lib/catalog-store";

/**
 * A shared menu link previews as the restaurant itself on WhatsApp and
 * Instagram: its name, tagline and first dish photo.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}): Promise<Metadata> {
  const { shop } = await searchParams;
  if (!shop || shop.length > 200) return {};
  try {
    const found = await readPublicCatalog(shop);
    if (!found) return {};
    const { settings, items } = found.catalog;
    const title = `${settings.name} · Menu`;
    const description = settings.tagline.replace(/\s+/g, " ");
    const photo = items.find((item) => item.available)?.image;
    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        images: photo ? [{ url: photo }] : undefined,
      },
    };
  } catch {
    // A preview is a nicety; the menu itself must still load.
    return {};
  }
}

export default function Menu() {
  return <Restaurant menuOnly />;
}
