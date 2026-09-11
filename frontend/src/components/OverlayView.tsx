import React, { useState } from 'react';
import { AssistantState, AssistantEmotion, ChatMessage, SystemActionResult } from '../types/assistant';
import { Live2DCanvas } from './Live2DCanvas';
import { StateIndicator } from './StateIndicator';
import { EmotionBadge } from './EmotionBadge';
import { ChatDrawer } from './ChatDrawer';
import { Maximize2, Settings, MessageSquare, Mic, Volume2 } from 'lucide-react';

interface OverlayViewProps {
  state: AssistantState;
  emotion: AssistantEmotion;
  assistantName: string;
  messages: ChatMessage[];
  latestAction: SystemActionResult | null;
  onSendMessage: (text: string) => void;
  onTriggerMic: () => void;
  onToggleMode: () => void;
  onOpenSettings: () => void;
  onTestSpeak: (text: string) => void;
}

export const OverlayView: React.FC<OverlayViewProps> = ({
  state,
  emotion,
  assistantName,
  messages,
  latestAction,
  onSendMessage,
  onTriggerMic,
  onToggleMode,
  onOpenSettings,
  onTestSpeak,
}) => {
  const [showChat, setShowChat] = useState<boolean>(false);

  // Latest assistant reply for quick speech bubble preview
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === 'assistant');

  return (
    <div
      data-tauri-drag-region
      className="relative flex flex-col w-[380px] h-[540px] rounded-3xl bg-slate-950/70 border border-white/15 backdrop-blur-2xl shadow-glass overflow-hidden select-none transition-all duration-300"
    >
      {/* Top Drag & Control Bar */}
      <div
        data-tauri-drag-region
        className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-slate-900/40 z-20 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <StateIndicator state={state} onClick={onTriggerMic} />
          <EmotionBadge emotion={emotion} />
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <button
            onClick={() => onTestSpeak("Hello, I am ready to help.")}
            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Test Voice"
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onToggleMode}
            className="p-1.5 rounded-lg hover:bg-white/10 hover:text-cyan-400 transition-colors cursor-pointer"
            title="Expand to Full Window"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Avatar Stage */}
      <div className="relative flex-1 flex flex-col items-center justify-center overflow-hidden">
        {/* Live2D Avatar Canvas with lip-sync */}
        <Live2DCanvas state={state} emotion={emotion} width={340} height={340} />

        {/* Speech Bubble / Last Utterance Overlay */}
        {lastAssistantMessage && !showChat && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-slate-900/80 border border-white/15 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-lg transition-all animate-fadeIn">
            <div className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider mb-0.5">
              {assistantName}
            </div>
            <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
              {lastAssistantMessage.text}
            </p>
          </div>
        )}
      </div>

      {/* Floating Action Trigger Bar */}
      <div className="relative z-20 px-4 py-3 border-t border-white/10 bg-slate-950/60 backdrop-blur-md flex items-center justify-between">
        <button
          onClick={() => setShowChat(!showChat)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
            showChat
              ? 'bg-cyan-600 border-cyan-400 text-white'
              : 'bg-slate-900/80 border-white/10 text-slate-300 hover:border-cyan-500/30'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>{showChat ? 'Hide Chat' : 'Chat & Commands'}</span>
        </button>

        <button
          onClick={onTriggerMic}
          className={`px-4 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all shadow-sm cursor-pointer ${
            state === 'listening'
              ? 'bg-red-500 border-red-400 text-white animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]'
              : 'bg-cyan-600/90 hover:bg-cyan-500 border-cyan-400 text-white shadow-glow-cyan'
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>{state === 'listening' ? 'Listening' : 'Talk'}</span>
        </button>
      </div>

      {/* Slide-over Chat Drawer inside Overlay */}
      {showChat && (
        <div className="absolute inset-0 z-30 pt-14 bg-slate-950/95 backdrop-blur-2xl animate-fadeIn">
          <ChatDrawer
            messages={messages}
            onSendMessage={onSendMessage}
            onTriggerMic={onTriggerMic}
            isListening={state === 'listening'}
            latestAction={latestAction}
          />
        </div>
      )}
    </div>
  );
};
