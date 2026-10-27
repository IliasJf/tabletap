export type Language = "en" | "fr" | "ar";
export type LocalizedText = Record<Language, string>;
/** A menu section ID chosen by the owner. */
export type Category = string;

export interface MenuCategory {
  id: Category;
  name: LocalizedText;
}

export interface MenuOption {
  id: string;
  label: LocalizedText;
  /** Additional price, in integer minor units (100 = 1 MAD). */
  price: number;
}

export interface MenuItem {
  id: string;
  category: Category;
  name: LocalizedText;
  description: LocalizedText;
  /** Price in integer minor units (100 = 1 MAD). */
  price: number;
  image: string;
  tags: string[];
  available: boolean;
  options: MenuOption[];
}

export interface RestaurantSettings {
  name: string;
  tagline: string;
  description: string;
  address: string;
  hours: string;
  /** Digits only, including country code. Blank until configured. */
  whatsapp: string;
  currency: "MAD";
  deliveryFee: number;
  /** Public site origin or base URL. Blank until configured. */
  publicUrl: string;
  /** Readable customer link name, such as "olive-and-ember". Blank uses the owner ID. */
  slug: string;
}

export interface Catalog {
  settings: RestaurantSettings;
  /** Menu sections in display order. */
  categories: MenuCategory[];
  items: MenuItem[];
  /** 0 for an unsaved menu; increments on every successful save. */
  revision: number;
}

export interface CartItem {
  /** Stable identity derived from item ID and selected option IDs. */
  key: string;
  itemId: string;
  optionIds: string[];
  quantity: number;
}

export type OrderType = "dine-in" | "takeaway" | "delivery";
export interface OrderDetails {
  name: string;
  type: OrderType;
  table: string;
  address: string;
  notes: string;
}

export interface AppUser {
  id: string;
  name: string;
  email: string;
}
