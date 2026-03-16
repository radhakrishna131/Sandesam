import { useState } from "react";
import { Search, Plus, Settings, LogOut, Moon, Sun } from "lucide-react";
import { useGetMe, useGetChats, useSearchUsers, useCreateChat, useLogout, getGetChatsQueryKey } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getInitials, formatChatDate } from "@/lib/utils";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "@/context/SocketContext";

export function Sidebar({ selectedChatId, onSelectChat }: { selectedChatId: number | null, onSelectChat: (id: number) => void }) {
  const { data: user } = useGetMe();
  const { data: chatsData } = useGetChats();
  const [searchQuery, setSearchQuery] = useState("");
  const { data: searchResults } = useSearchUsers({ phone: searchQuery }, { query: { enabled: searchQuery.length > 2 }});
  const createChatMutation = useCreateChat();
  const logoutMutation = useLogout();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { onlineUsers } = useSocket();

  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        setLocation("/login");
      }
    });
  };

  const startChat = (otherUserId: number) => {
    createChatMutation.mutate({ data: { otherUserId } }, {
      onSuccess: (chat) => {
        setSearchQuery("");
        onSelectChat(chat.chatId);
        queryClient.invalidateQueries({ queryKey: getGetChatsQueryKey() });
      }
    });
  };

  const chats = chatsData?.chats || [];

  return (
    <div className="w-80 lg:w-96 flex flex-col h-full bg-card border-r border-border z-10 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-border/50 bg-background/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 ring-2 ring-primary/20">
            <AvatarImage src={user?.profilePictureUrl || undefined} />
            <AvatarFallback>{getInitials(user?.username, user?.phoneNumber)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-display font-bold text-foreground leading-none">Sandesam</h2>
            <p className="text-xs text-muted-foreground font-medium truncate w-32">{user?.username}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={toggleTheme}>
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={handleLogout}>
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search by phone..." 
            className="pl-9 h-10 bg-secondary/50 border-none focus-visible:ring-2 focus-visible:ring-primary/20 rounded-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Chat List */}
      <ScrollArea className="flex-1 px-2">
        {searchQuery.length > 2 ? (
          <div className="space-y-1">
            <h3 className="px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Results</h3>
            {searchResults?.users.map(u => (
              <button 
                key={u.id}
                onClick={() => startChat(u.id)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/80 transition-colors text-left"
              >
                <Avatar className="w-12 h-12">
                  <AvatarImage src={u.profilePictureUrl || undefined} />
                  <AvatarFallback>{getInitials(u.username, u.phoneNumber)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <h4 className="font-semibold text-sm truncate">{u.username || u.phoneNumber}</h4>
                  <p className="text-xs text-muted-foreground truncate">{u.phoneNumber}</p>
                </div>
                <Plus className="w-4 h-4 text-primary" />
              </button>
            ))}
            {searchResults?.users.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-4">No users found</p>
            )}
          </div>
        ) : (
          <div className="space-y-1 pb-4">
            {chats.map(chat => {
              const isSelected = selectedChatId === chat.chatId;
              const isOnline = onlineUsers.has(chat.otherUser.id);
              
              return (
                <button
                  key={chat.chatId}
                  onClick={() => onSelectChat(chat.chatId)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all duration-200 text-left relative group ${
                    isSelected ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'hover:bg-secondary/60 text-foreground'
                  }`}
                >
                  <div className="relative">
                    <Avatar className={`w-12 h-12 transition-transform ${isSelected ? 'ring-2 ring-white/20' : 'group-hover:scale-105'}`}>
                      <AvatarImage src={chat.otherUser.profilePictureUrl || undefined} />
                      <AvatarFallback className={isSelected ? 'bg-white/20 text-white' : ''}>
                        {getInitials(chat.otherUser.username, chat.otherUser.phoneNumber)}
                      </AvatarFallback>
                    </Avatar>
                    {isOnline && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-card rounded-full"></span>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline mb-1">
                      <h4 className={`font-semibold text-[15px] truncate ${isSelected ? 'text-white' : ''}`}>
                        {chat.otherUser.username || chat.otherUser.phoneNumber}
                      </h4>
                      {chat.lastMessage && (
                        <span className={`text-[11px] whitespace-nowrap ml-2 ${isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                          {formatChatDate(chat.lastMessage.timestamp)}
                        </span>
                      )}
                    </div>
                    
                    <p className={`text-[13px] truncate ${isSelected ? 'text-primary-foreground/90 font-medium' : 'text-muted-foreground'}`}>
                      {chat.lastMessage?.messageText || 
                       (chat.lastMessage?.fileType ? `📎 ${chat.lastMessage.fileName || 'Attachment'}` : 'Start chatting')}
                    </p>
                  </div>
                </button>
              );
            })}
            
            {chats.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <img src={`${import.meta.env.BASE_URL}images/empty-chat.png`} alt="No chats" className="w-32 h-32 opacity-50 mb-4 mix-blend-luminosity" />
                <p className="text-muted-foreground text-sm">Search for a phone number<br/>to start a conversation</p>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
