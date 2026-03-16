import { Router } from "express";
import { db } from "@workspace/db";
import { chatsTable, messagesTable, usersTable } from "@workspace/db/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth.js";
import { io } from "../index.js";

const router = Router();

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    phoneNumber: user.phoneNumber,
    username: user.username ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
    profilePictureUrl: user.profilePictureUrl ?? null,
    createdAt: user.createdAt.toISOString(),
    lastSeen: user.lastSeen?.toISOString() ?? null,
  };
}

function formatMessage(msg: typeof messagesTable.$inferSelect, sender?: typeof usersTable.$inferSelect) {
  return {
    messageId: msg.messageId,
    chatId: msg.chatId,
    senderId: msg.senderId,
    messageText: msg.messageText ?? null,
    fileUrl: msg.fileUrl ?? null,
    fileType: msg.fileType ?? null,
    fileName: msg.fileName ?? null,
    timestamp: msg.timestamp.toISOString(),
    sender: sender ? formatUser(sender) : null,
  };
}

router.get("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;

  try {
    const chats = await db.select()
      .from(chatsTable)
      .where(or(eq(chatsTable.user1Id, userId), eq(chatsTable.user2Id, userId)));

    const result = await Promise.all(chats.map(async (chat) => {
      const otherUserId = chat.user1Id === userId ? chat.user2Id : chat.user1Id;
      const [otherUser] = await db.select().from(usersTable).where(eq(usersTable.id, otherUserId)).limit(1);
      const [lastMsg] = await db.select().from(messagesTable)
        .where(eq(messagesTable.chatId, chat.chatId))
        .orderBy(desc(messagesTable.timestamp))
        .limit(1);

      return {
        chatId: chat.chatId,
        otherUser: formatUser(otherUser),
        lastMessage: lastMsg ? formatMessage(lastMsg) : null,
        createdAt: chat.createdAt.toISOString(),
      };
    }));

    result.sort((a, b) => {
      const aTime = a.lastMessage?.timestamp ?? a.createdAt;
      const bTime = b.lastMessage?.timestamp ?? b.createdAt;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });

    res.json({ chats: result });
  } catch (err) {
    console.error("Get chats error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const { otherUserId } = req.body;

  if (!otherUserId) {
    res.status(400).json({ error: "otherUserId required" });
    return;
  }

  if (otherUserId === userId) {
    res.status(400).json({ error: "Cannot chat with yourself" });
    return;
  }

  try {
    const existing = await db.select().from(chatsTable).where(
      or(
        and(eq(chatsTable.user1Id, userId), eq(chatsTable.user2Id, otherUserId)),
        and(eq(chatsTable.user1Id, otherUserId), eq(chatsTable.user2Id, userId))
      )
    ).limit(1);

    let chat = existing[0];
    if (!chat) {
      [chat] = await db.insert(chatsTable).values({
        user1Id: userId,
        user2Id: otherUserId,
      }).returning();
    }

    const [otherUser] = await db.select().from(usersTable).where(eq(usersTable.id, otherUserId)).limit(1);
    if (!otherUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [lastMsg] = await db.select().from(messagesTable)
      .where(eq(messagesTable.chatId, chat.chatId))
      .orderBy(desc(messagesTable.timestamp))
      .limit(1);

    res.json({
      chatId: chat.chatId,
      otherUser: formatUser(otherUser),
      lastMessage: lastMsg ? formatMessage(lastMsg) : null,
      createdAt: chat.createdAt.toISOString(),
    });
  } catch (err) {
    console.error("Create chat error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:chatId/messages", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const chatId = parseInt(req.params.chatId);
  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before as string | undefined;

  if (isNaN(chatId)) {
    res.status(400).json({ error: "Invalid chat ID" });
    return;
  }

  try {
    const [chat] = await db.select().from(chatsTable)
      .where(
        and(
          eq(chatsTable.chatId, chatId),
          or(eq(chatsTable.user1Id, userId), eq(chatsTable.user2Id, userId))
        )
      ).limit(1);

    if (!chat) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.chatId, chatId))
      .orderBy(desc(messagesTable.timestamp))
      .limit(limit);

    const senderIds = [...new Set(msgs.map(m => m.senderId))];
    const senders = await Promise.all(
      senderIds.map(id => db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1).then(r => r[0]))
    );
    const senderMap = new Map(senders.filter(Boolean).map(u => [u.id, u]));

    const messages = msgs.reverse().map(msg => formatMessage(msg, senderMap.get(msg.senderId)));
    res.json({ messages });
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:chatId/messages", requireAuth, async (req, res) => {
  const userId = req.session.userId!;
  const chatId = parseInt(req.params.chatId);

  if (isNaN(chatId)) {
    res.status(400).json({ error: "Invalid chat ID" });
    return;
  }

  const { messageText, fileUrl, fileType, fileName } = req.body;

  if (!messageText && !fileUrl) {
    res.status(400).json({ error: "Message text or file required" });
    return;
  }

  try {
    const [chat] = await db.select().from(chatsTable)
      .where(
        and(
          eq(chatsTable.chatId, chatId),
          or(eq(chatsTable.user1Id, userId), eq(chatsTable.user2Id, userId))
        )
      ).limit(1);

    if (!chat) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    const [msg] = await db.insert(messagesTable).values({
      chatId,
      senderId: userId,
      messageText: messageText ?? null,
      fileUrl: fileUrl ?? null,
      fileType: fileType ?? null,
      fileName: fileName ?? null,
    }).returning();

    const [sender] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    const formatted = formatMessage(msg, sender);

    io.to(`chat:${chatId}`).emit("message", formatted);

    res.status(201).json(formatted);
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
