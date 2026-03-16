import http from "http";
import { Server } from "socket.io";
import app from "./app";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = http.createServer(app);

export const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
  path: "/api/socket.io",
});

const onlineUsers = new Map<number, string>();

io.on("connection", (socket) => {
  let currentUserId: number | null = null;

  socket.on("join", async (userId: number) => {
    currentUserId = userId;
    socket.join(`user:${userId}`);
    onlineUsers.set(userId, socket.id);

    try {
      await db.update(usersTable)
        .set({ lastSeen: new Date() })
        .where(eq(usersTable.id, userId));
    } catch {}

    io.emit("userStatus", { userId, online: true });
  });

  socket.on("joinChat", (chatId: number) => {
    socket.join(`chat:${chatId}`);
  });

  socket.on("leaveChat", (chatId: number) => {
    socket.leave(`chat:${chatId}`);
  });

  socket.on("typing", ({ chatId, isTyping }: { chatId: number; isTyping: boolean }) => {
    if (currentUserId) {
      socket.to(`chat:${chatId}`).emit("typing", {
        chatId,
        userId: currentUserId,
        isTyping,
      });
    }
  });

  socket.on("disconnect", async () => {
    if (currentUserId) {
      onlineUsers.delete(currentUserId);
      const userId = currentUserId;

      try {
        await db.update(usersTable)
          .set({ lastSeen: new Date() })
          .where(eq(usersTable.id, userId));
      } catch {}

      io.emit("userStatus", { userId, online: false, lastSeen: new Date().toISOString() });
    }
  });
});

export function isUserOnline(userId: number): boolean {
  return onlineUsers.has(userId);
}

httpServer.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
