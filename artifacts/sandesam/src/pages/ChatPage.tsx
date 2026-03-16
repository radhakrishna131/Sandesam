import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { Sidebar } from "@/components/chat/Sidebar";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Loader2, MessageSquare } from "lucide-react";

export default function ChatPage() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useGetMe({ query: { retry: false } });
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);

  useEffect(() => {
    if (isError) {
      setLocation("/login");
    } else if (user && (!user.username || !user.dateOfBirth)) {
      setLocation("/setup-profile");
    }
    
    // Check local storage for theme
    if (localStorage.getItem("theme") === "dark" || (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    }
  }, [user, isError, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-teal-500/20 animate-pulse">
            <MessageSquare className="text-white w-8 h-8" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="h-screen w-full flex bg-background overflow-hidden selection:bg-primary/20">
      <Sidebar selectedChatId={selectedChatId} onSelectChat={setSelectedChatId} />
      
      {selectedChatId ? (
        <ChatWindow chatId={selectedChatId} onChatDeleted={() => setSelectedChatId(null)} />
      ) : (
        <div className="flex-1 hidden md:flex flex-col items-center justify-center bg-background relative z-0">
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.02] pointer-events-none">
             <img src={`${import.meta.env.BASE_URL}images/logo-icon.png`} alt="" className="w-96 h-96 grayscale" />
          </div>
          
          <div className="text-center animate-in zoom-in-95 fade-in duration-500 relative z-10">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-emerald-500/10 to-teal-600/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
              <MessageSquare className="w-10 h-10 text-emerald-500" />
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">Sandesam Web</h2>
            <p className="text-muted-foreground max-w-sm text-sm">Send and receive messages in real-time. Select a chat from the sidebar to start a conversation.</p>
          </div>
        </div>
      )}
    </div>
  );
}
