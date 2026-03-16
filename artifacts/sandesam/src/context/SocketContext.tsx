import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMessagesQueryKey, getGetChatsQueryKey } from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react/src/generated/api.schemas";

interface SocketContextType {
  socket: Socket | null;
  onlineUsers: Set<number>;
  typingUsers: Map<number, number[]>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  onlineUsers: new Set(),
  typingUsers: new Map(),
});

export const useSocket = () => useContext(SocketContext);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Map<number, number[]>>(new Map());
  const queryClient = useQueryClient();
  
  const { data: user } = useGetMe({ query: { retry: false } });

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      return;
    }

    const newSocket = io(window.location.origin, {
      path: "/api/socket.io",
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
    });

    newSocket.on("connect", () => {
      newSocket.emit("join", user.id);
    });

    newSocket.on("message", (newMessage: Message) => {
      queryClient.setQueryData(getGetMessagesQueryKey(newMessage.chatId), (oldData: any) => {
        if (!oldData) return { messages: [newMessage] };
        if (oldData.messages.some((m: Message) => m.messageId === newMessage.messageId)) {
          return oldData;
        }
        return { ...oldData, messages: [...oldData.messages, newMessage] };
      });

      queryClient.setQueryData(getGetChatsQueryKey(), (oldData: any) => {
        if (!oldData) return oldData;
        const chatIndex = oldData.chats.findIndex((c: any) => c.chatId === newMessage.chatId);
        if (chatIndex > -1) {
          const updatedChats = [...oldData.chats];
          updatedChats[chatIndex] = { ...updatedChats[chatIndex], lastMessage: newMessage };
          const [chat] = updatedChats.splice(chatIndex, 1);
          updatedChats.unshift(chat);
          return { chats: updatedChats };
        } else {
          queryClient.invalidateQueries({ queryKey: getGetChatsQueryKey() });
          return oldData;
        }
      });
    });

    newSocket.on("messageDeleted", (updatedMessage: Message) => {
      queryClient.setQueryData(getGetMessagesQueryKey(updatedMessage.chatId), (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          messages: oldData.messages.map((m: Message) =>
            m.messageId === updatedMessage.messageId ? updatedMessage : m
          ),
        };
      });

      queryClient.setQueryData(getGetChatsQueryKey(), (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          chats: oldData.chats.map((c: any) => {
            if (c.chatId === updatedMessage.chatId && c.lastMessage?.messageId === updatedMessage.messageId) {
              return { ...c, lastMessage: updatedMessage };
            }
            return c;
          }),
        };
      });
    });

    newSocket.on("chatDeleted", ({ chatId }: { chatId: number }) => {
      queryClient.setQueryData(getGetChatsQueryKey(), (oldData: any) => {
        if (!oldData) return oldData;
        return { ...oldData, chats: oldData.chats.filter((c: any) => c.chatId !== chatId) };
      });
      queryClient.removeQueries({ queryKey: getGetMessagesQueryKey(chatId) });
    });

    newSocket.on("userStatus", ({ userId, online }: { userId: number, online: boolean }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    });

    newSocket.on("typing", ({ chatId, userId, isTyping }: { chatId: number, userId: number, isTyping: boolean }) => {
      setTypingUsers(prev => {
        const next = new Map(prev);
        const chatTyping = next.get(chatId) || [];
        if (isTyping && !chatTyping.includes(userId)) {
          next.set(chatId, [...chatTyping, userId]);
        } else if (!isTyping) {
          next.set(chatId, chatTyping.filter(id => id !== userId));
        }
        return next;
      });
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user?.id, queryClient]);

  return (
    <SocketContext.Provider value={{ socket, onlineUsers, typingUsers }}>
      {children}
    </SocketContext.Provider>
  );
}
