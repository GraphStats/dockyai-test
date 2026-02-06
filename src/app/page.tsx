"use client";

import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";
import Leaderboard from "@/components/Leaderboard";
import { PuterProvider, usePuter } from "@/components/PuterProvider";
import { MODELS, Conversation, Message } from "@/lib/models";
import { chatWithModel } from "@/lib/actions";

function Dashboard() {
  const { chat: puterChat, user } = usePuter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<string>('chat');
  const [isLoading, setIsLoading] = useState(false);

  // Streaming state
  const [streamingContent, setStreamingContent] = useState("");

  // Blind Test state
  const [isBlindTest, setIsBlindTest] = useState(false);
  const [blindResponses, setBlindResponses] = useState<{ id: string, content: string }[]>([]);

  // Init Logic
  useEffect(() => {
    const saved = localStorage.getItem('docky_conversations');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConversations(parsed);
      if (parsed.length > 0) {
        setActiveConversationId(parsed[0].id);
      } else {
        handleNewChat();
      }
    } else {
      handleNewChat();
    }
  }, []);

  // Persist
  useEffect(() => {
    if (conversations.length >= 0) {
      localStorage.setItem('docky_conversations', JSON.stringify(conversations));
    }
  }, [conversations]);

  const handleNewChat = () => {
    const newId = Math.random().toString(36).substring(7);
    const newConv: Conversation = {
      id: newId,
      title: "Nouvelle discussion",
      messages: [],
      modelId: MODELS[0].id,
      createdAt: Date.now()
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newId);
    setCurrentPage('chat');
    setIsBlindTest(false);
    setBlindResponses([]);
    setStreamingContent("");
  };

  const handleDeleteConversation = (id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeConversationId === id) {
        if (filtered.length > 0) {
          setActiveConversationId(filtered[0].id);
        } else {
          setActiveConversationId(null);
          // We don't call handleNewChat inside here to avoid loop, 
          // useEffect will catch empty state if needed or just show empty
        }
      }
      return filtered;
    });
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  const smoothStream = async (text: string, onUpdate: (current: string) => void) => {
    let current = "";
    const parts = text.split("");
    for (const char of parts) {
      current += char;
      onUpdate(current);
      await new Promise(r => setTimeout(r, Math.random() * 5 + 5));
    }
  };

  const handleSendMessage = async (content: string, modelId: string) => {
    if (!activeConversationId || !activeConversation) return;

    const userMessage: Message = { role: 'user', content };
    const updatedMessages = [...activeConversation.messages, userMessage];

    updateConversationMessages(activeConversationId, updatedMessages);
    setIsLoading(true);
    setStreamingContent("");

    const currentModel = MODELS.find(m => m.id === modelId);
    const triggerBlind = !isBlindTest && updatedMessages.length >= 3 && Math.random() < 0.1 && currentModel?.tier === 'free';

    try {
      if (triggerBlind) {
        setIsBlindTest(true);
        const freeModels = MODELS.filter(m => m.tier === 'free');
        const m1 = freeModels[Math.floor(Math.random() * freeModels.length)];
        const m2 = freeModels.filter(m => m.id !== m1.id)[Math.floor(Math.random() * (freeModels.length - 1))];

        const [r1, r2] = await Promise.all([
          chatWithModel(m1.id, updatedMessages),
          chatWithModel(m2.id, updatedMessages)
        ]);

        setBlindResponses([
          { id: m1.id, content: r1.content || "Erreur" },
          { id: m2.id, content: r2.content || "Erreur" }
        ]);
      } else {
        let finalContent = "";

        if (currentModel?.provider === 'puter') {
          if (!user) throw new Error("Veuillez connecter Puter.");

          // Clean messages for Puter SDK
          const cleanHistory = updatedMessages.map(m => ({
            role: m.role,
            content: m.content
          }));

          try {
            await puterChat(modelId, cleanHistory, (chunk) => {
              finalContent += chunk;
              setStreamingContent(finalContent);
            });

            // Deduct credit on success
            const currentCredits = parseInt(localStorage.getItem('docky_credits') || '100');
            localStorage.setItem('docky_credits', Math.max(0, currentCredits - 1).toString());

          } catch (err: any) {
            throw new Error(err.message || "Le service Puter a rencontré une erreur.");
          }
        }
        else if (currentModel?.provider === 'groq' || currentModel?.provider === 'huggingface' || currentModel?.provider === 'openrouter') {
          const response = await fetch('/api/chat', {
            method: 'POST',
            body: JSON.stringify({ modelId, messages: updatedMessages }),
          });


          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Erreur de streaming");
          }

          const reader = response.body?.getReader();
          const decoder = new TextDecoder();

          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = decoder.decode(value);
              for (const char of chunk) {
                finalContent += char;
                setStreamingContent(finalContent);
                await new Promise(r => setTimeout(r, 10));
              }
            }
          }
        } else {
          const response = await chatWithModel(modelId, updatedMessages);
          if (response.error) throw new Error(response.error);
          finalContent = response.content;
          await smoothStream(finalContent, setStreamingContent);
        }

        const assistantMessage: Message = { role: 'assistant', content: finalContent, modelId };
        updateConversationMessages(activeConversationId, [...updatedMessages, assistantMessage]);
        setStreamingContent("");

        if (activeConversation.messages.length === 0) {
          updateConversationTitle(activeConversationId, content.substring(0, 30) + (content.length > 30 ? "..." : ""));
        }
      }
    } catch (err: any) {
      console.error(err);
      const errorMessage: Message = { role: 'assistant', content: `Erreur : ${err.message}` };
      updateConversationMessages(activeConversationId, [...updatedMessages, errorMessage]);
      setStreamingContent("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBlindVote = (winnerId: string) => {
    if (!activeConversationId || !activeConversation) return;
    const winnerContent = blindResponses.find(r => r.id === winnerId)?.content || "";
    const assistantMessage: Message = { role: 'assistant', content: winnerContent, modelId: winnerId, isBlind: true };
    updateConversationMessages(activeConversationId, [...activeConversation.messages, assistantMessage]);
    setBlindResponses([]);
    setIsBlindTest(false);
    const votes = JSON.parse(localStorage.getItem('docky_votes') || '{}');
    votes[winnerId] = (votes[winnerId] || 0) + 1;
    localStorage.setItem('docky_votes', JSON.stringify(votes));
  };

  const updateConversationMessages = (id: string, messages: Message[]) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, messages } : c));
  };

  const updateConversationTitle = (id: string, title: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title } : c));
  };

  const handleModelChange = (modelId: string) => {
    if (!activeConversationId) return;
    setConversations(prev => prev.map(c => c.id === activeConversationId ? { ...c, modelId } : c));
  };

  return (
    <div className="flex min-h-screen bg-background text-white selection:bg-white/10">
      <Sidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveConversationId(id);
          setCurrentPage('chat');
          setIsBlindTest(false);
          setBlindResponses([]);
          setStreamingContent("");
        }}
        onDeleteConversation={handleDeleteConversation}
        onNewChat={handleNewChat}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
      />
      <main className="flex-1 lg:pl-72 transition-all duration-300">
        <div className="h-full relative">
          {currentPage === 'chat' ? (
            <ChatWindow
              messages={activeConversation?.messages || []}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              streamingContent={streamingContent}
              currentModelId={activeConversation?.modelId || MODELS[0].id}
              onModelChange={handleModelChange}
              isBlindTest={isBlindTest}
              blindResponses={blindResponses}
              onBlindVote={handleBlindVote}
            />
          ) : (
            <Leaderboard />
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <PuterProvider>
      <Dashboard />
    </PuterProvider>
  );
}
