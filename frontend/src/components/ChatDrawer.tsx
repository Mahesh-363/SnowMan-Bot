import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, SystemActionResult } from '../types/assistant';
import { Send, Mic, Sparkles, Terminal, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface ChatDrawerProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onTriggerMic: () => void;
  isListening: boolean;
  latestAction?: SystemActionResult | null;
}

export const ChatDrawer: React.FC<ChatDrawerProps> = ({
  messages,
  onSendMessage,
  onTriggerMic,
  isListening,
  latestAction,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, latestAction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-glass">
      {/* Action Banner (if active) */}
      {latestAction && (
        <div
          className={`px-3.5 py-2 text-xs flex items-center gap-2 border-b backdrop-blur-md transition-all ${
            latestAction.status === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/30 text-emerald-300'
              : latestAction.status === 'blocked'
              ? 'bg-amber-950/50 border-amber-500/30 text-amber-300'
              : 'bg-rose-950/50 border-rose-500/30 text-rose-300'
          }`}
        >
          {latestAction.status === 'success' ? (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          ) : (
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          )}
          <span className="truncate">{latestAction.message}</span>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-4 space-y-2">
            <Sparkles className="w-7 h-7 text-cyan-400/70 animate-pulse-subtle" />
            <p className="text-sm font-medium text-slate-300">Say "Snowman" or type a command</p>
            <p className="text-xs text-slate-500 max-w-xs">
              Try: "Open YouTube", "Open Calculator", "Search for machine learning", or "How is my system doing?"
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${
                    isUser
                      ? 'bg-cyan-600 text-white rounded-tr-xs'
                      : 'bg-slate-800/80 text-slate-200 border border-white/10 rounded-tl-xs backdrop-blur-md'
                  }`}
                >
                  <p>{msg.text}</p>

                  {/* Tool Call indicator */}
                  {msg.toolCall && (
                    <div className="mt-2 pt-1.5 border-t border-white/10 flex items-center gap-1.5 text-[11px] text-cyan-300 font-mono">
                      <Terminal className="w-3 h-3" />
                      <span>{msg.toolCall.name}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-500 mt-1 px-1">{msg.timestamp}</span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat & Voice Input Bar */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-white/10 bg-slate-950/50 backdrop-blur-md flex items-center gap-2">
        <button
          type="button"
          onClick={onTriggerMic}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            isListening
              ? 'bg-red-500 text-white border-red-400 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]'
              : 'bg-slate-800 hover:bg-slate-700 text-cyan-400 border-white/10 hover:border-cyan-500/30'
          }`}
          title={isListening ? 'Listening... click to stop' : 'Click to speak'}
        >
          <Mic className="w-4 h-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={isListening ? "Listening to your voice... (speak now)" : "Ask Snowman anything..."}
          className={`flex-1 text-sm text-slate-100 placeholder-slate-500 px-3.5 py-2 rounded-xl border focus:outline-none transition-all ${
            isListening
              ? 'bg-red-950/30 border-red-500/50 text-red-200 placeholder-red-400/70'
              : 'bg-slate-900/80 border-white/10 focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30'
          }`}
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all shadow-glow-cyan cursor-pointer"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
