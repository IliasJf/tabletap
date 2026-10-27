import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const restaurantCatalogs = sqliteTable("restaurant_catalogs", {
  ownerId: text("owner_id").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: integer("updated_at").notNull(),
  /** Readable public link name; NULL until the owner chooses one. */
  slug: text("slug").unique(),
});

/** Owner-uploaded dish photos, stored as base64 so D1 and node:sqlite agree. */
export const menuImages = sqliteTable(
  "menu_images",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    contentType: text("content_type").notNull(),
    data: text("data").notNull(),
    byteLength: integer("byte_length").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("menu_images_owner_idx").on(table.ownerId)],
);

/** Orders a customer prepared and opened in WhatsApp. */
export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    createdAt: integer("created_at").notNull(),
    payload: text("payload").notNull(),
  },
  (table) => [
    index("orders_owner_created_idx").on(table.ownerId, table.createdAt),
  ],
);

/** Café owners who sign in with an emailed code. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

/** One pending sign-in code per email; only a hash of the code is stored. */
export const loginCodes = sqliteTable("login_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash").notNull(),
  expiresAt: integer("expires_at").notNull(),
  attempts: integer("attempts").notNull(),
  createdAt: integer("created_at").notNull(),
});

/** Signed-in browsers; the cookie holds the token, the table only its hash. */
export const sessions = sqliteTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);
