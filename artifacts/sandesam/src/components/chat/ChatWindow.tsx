import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, FileText, Image as ImageIcon, Download, Loader2 } from "lucide-react";
import { useGetMe, useGetChats, useGetMessages, useSendMessage, useUploadFile } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatMessageTime, formatChatDate, getInitials } from "@/lib/utils";
import { useSocket } from "@/context/SocketContext";

export function ChatWindow({ chatId }: { chatId: number }) {
  const { data: user } = useGetMe();
  const { data: chatsData } = useGetChats();
  const { data: messagesData, isLoading: messagesLoading } = useGetMessages(chatId);
  const sendMessageMutation = useSendMessage();
  const uploadMutation = useUploadFile();
  const { socket, onlineUsers, typingUsers } = useSocket();

  const [inputText, setInputText] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const chat = chatsData?.chats.find(c => c.chatId === chatId);
  const otherUser = chat?.otherUser;
  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;
  const isOtherTyping = typingUsers.get(chatId)?.includes(otherUser?.id || -1);

  // Join chat room on socket
  useEffect(() => {
    if (!socket) return;
    socket.emit("joinChat", chatId);
    return () => {
      socket.emit("leaveChat", chatId);
    };
  }, [socket, chatId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesData?.messages, isOtherTyping]);

  // Typing indicator emit
  useEffect(() => {
    if (!socket || !user) return;
    const timeout = setTimeout(() => {
      socket.emit("typing", { chatId, userId: user.id, isTyping: false });
    }, 2000);

    if (inputText.length > 0) {
      socket.emit("typing", { chatId, userId: user.id, isTyping: true });
    }

    return () => clearTimeout(timeout);
  }, [inputText, chatId, socket, user]);

  const handleSend = () => {
    if (!inputText.trim()) return;
    sendMessageMutation.mutate({ chatId, data: { messageText: inputText.trim() } }, {
      onSuccess: () => setInputText("")
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const res = await uploadMutation.mutateAsync({ data: { file } });
      await sendMessageMutation.mutateAsync({
        chatId,
        data: {
          fileUrl: res.url,
          fileType: res.fileType,
          fileName: res.fileName,
          messageText: "" // Optional caption could go here
        }
      });
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const renderMessageContent = (msg: any) => {
    if (msg.fileUrl) {
      const isImg = msg.fileType?.startsWith('image/');
      const isVid = msg.fileType?.startsWith('video/');
      
      return (
        <div className="flex flex-col gap-2">
          {isImg && <img src={msg.fileUrl} alt="attachment" className="max-w-[250px] sm:max-w-xs rounded-xl cursor-pointer hover:opacity-90 transition-opacity" />}
          {isVid && <video src={msg.fileUrl} controls className="max-w-[250px] sm:max-w-xs rounded-xl" />}
          {!isImg && !isVid && (
            <div className="flex items-center gap-3 bg-background/20 p-3 rounded-xl border border-background/10">
              <FileText className="w-8 h-8 text-white/80" />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium truncate">{msg.fileName || 'Document'}</p>
                <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 mt-1 opacity-80 hover:opacity-100 hover:underline">
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            </div>
          )}
          {msg.messageText && <p>{msg.messageText}</p>}
        </div>
      );
    }
    return <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{msg.messageText}</p>;
  };

  if (!otherUser) return null;

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative z-0">
      {/* Abstract Background pattern */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}>
      </div>

      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-xl z-10">
        <div className="flex items-center gap-4">
          <Avatar className="w-10 h-10 ring-2 ring-border shadow-sm">
            <AvatarImage src={otherUser.profilePictureUrl || undefined} />
            <AvatarFallback>{getInitials(otherUser.username, otherUser.phoneNumber)}</AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-[16px] text-foreground leading-tight">
              {otherUser.username || otherUser.phoneNumber}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isOnline ? (
                <span className="text-emerald-500 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Online
                </span>
              ) : (
                otherUser.lastSeen ? `Last seen ${formatChatDate(otherUser.lastSeen)}` : 'Offline'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 lg:px-8 py-4 z-0">
        {messagesLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {messagesData?.messages.map((msg, i) => {
              const isMe = msg.senderId === user?.id;
              const isSequential = i > 0 && messagesData.messages[i-1].senderId === msg.senderId;
              
              return (
                <div key={msg.messageId} className={`flex w-full ${isMe ? 'justify-end' : 'justify-start'} ${isSequential ? 'mt-1' : 'mt-4'}`}>
                  <div className={`max-w-[75%] lg:max-w-[65%] rounded-2xl px-4 py-2.5 shadow-sm relative group animate-in fade-in slide-in-from-bottom-2 duration-300 ${
                    isMe 
                      ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-tr-[4px]' 
                      : 'bg-card border border-border text-foreground rounded-tl-[4px]'
                  }`}>
                    {renderMessageContent(msg)}
                    <div className={`text-[10px] mt-1 flex items-center justify-end gap-1 ${isMe ? 'text-teal-100' : 'text-muted-foreground'}`}>
                      {formatMessageTime(msg.timestamp)}
                    </div>
                  </div>
                </div>
              );
            })}
            
            {isOtherTyping && (
              <div className="flex justify-start mt-4">
                <div className="bg-card border border-border rounded-2xl rounded-tl-[4px] px-4 py-3 shadow-sm w-fit flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full typing-dot"></span>
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full typing-dot"></span>
                  <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full typing-dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 bg-background/80 backdrop-blur-xl border-t border-border/50 z-10">
        <div className="max-w-4xl mx-auto flex items-end gap-2 bg-card border border-border rounded-3xl p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <input type="file" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full h-10 w-10 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
          </Button>
          
          <textarea 
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            className="flex-1 bg-transparent border-none resize-none max-h-32 min-h-[40px] py-2.5 px-2 text-[15px] focus:outline-none placeholder:text-muted-foreground/60"
            rows={1}
          />
          
          <Button 
            size="icon" 
            variant="gradient"
            className="rounded-full h-10 w-10 shrink-0 shadow-md"
            onClick={handleSend}
            disabled={!inputText.trim()}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
