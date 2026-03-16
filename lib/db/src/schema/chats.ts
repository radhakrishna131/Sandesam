import { pgTable, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const chatsTable = pgTable("chats", {
  chatId: serial("chat_id").primaryKey(),
  user1Id: integer("user1_id")
    .notNull()
    .references(() => usersTable.id),
  user2Id: integer("user2_id")
    .notNull()
    .references(() => usersTable.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Chat = typeof chatsTable.$inferSelect;
