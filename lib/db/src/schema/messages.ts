import { pgTable, serial, integer, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { chatsTable } from "./chats";
import { usersTable } from "./users";

export const messagesTable = pgTable("messages", {
  messageId: serial("message_id").primaryKey(),
  chatId: integer("chat_id")
    .notNull()
    .references(() => chatsTable.chatId),
  senderId: integer("sender_id")
    .notNull()
    .references(() => usersTable.id),
  messageText: text("message_text"),
  fileUrl: text("file_url"),
  fileType: text("file_type"),
  fileName: text("file_name"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type Message = typeof messagesTable.$inferSelect;
