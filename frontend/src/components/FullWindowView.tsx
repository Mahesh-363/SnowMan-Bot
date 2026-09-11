import React from 'react';
import { AssistantState, AssistantEmotion, ChatMessage, SystemActionResult, SnowmanConfig } from '../types/assistant';
import { Live2DCanvas } from './Live2DCanvas';
import { StateIndicator } from './StateIndicator';
import { EmotionBadge } from './EmotionBadge';
import { ChatDrawer } from './ChatDrawer';
import { Minimize2, Settings, Sparkles, Volume2, ShieldCheck, Activity, Cpu } from 'lucide-react';

interface FullWindowViewProps {
  state: AssistantState;
  emotion: AssistantEmotion;
  assistantName: string;
  config: SnowmanConfig;
  messages: ChatMessage[];
  latestAction: SystemActionResult | null;
  onSendMessage: (text: string) => void;
  onTriggerMic: () => void;
  onToggleMode: () => void;
  onOpenSettings: () => void;
  onTestSpeak: (text: string) => void;
}

export const FullWindowView: React.FC<FullWindowViewProps> = ({
  state,
  emotion,
  assistantName,
  config,
  messages,
  latestAction,
  onSendMessage,
  onTriggerMic,
  onToggleMode,
  onOpenSettings,
  onTestSpeak,
}) => {
  return (
    <div className="flex flex-col w-screen h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Application Bar */}
      <header
        data-tauri-drag-region
        className="flex items-center justify-between px-6 py-3.5 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl z-20"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold shadow-glow-cyan">
              S
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                {assistantName}
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-cyan-950/60 border border-cyan-500/30 text-cyan-400">
                  v1.0 Desktop
                </span>
              </h1>
              <p className="text-[11px] text-slate-400">Live2D Desktop AI Voice Assistant</p>
            </div>
          </div>
        </div>

        {/* Center: State and Emotion */}
        <div className="flex items-center gap-3">
          <StateIndicator state={state} onClick={onTriggerMic} />
          <EmotionBadge emotion={emotion} />
        </div>

        {/* Right: Quick Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTestSpeak("Hello! Live2D and voice synthesis are active.")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-cyan-500/30 bg-slate-900/60 text-xs text-slate-300 hover:text-cyan-300 transition-all cursor-pointer"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>Test Voice</span>
          </button>

          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-cyan-500/30 bg-slate-900/60 text-xs text-slate-300 hover:text-cyan-300 transition-all cursor-pointer"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>

          <button
            onClick={onToggleMode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/50 text-xs font-medium transition-all cursor-pointer"
            title="Switch to Floating Overlay mode"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span>Overlay Mode</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left Column: Live2D Avatar Showcase + Telemetry */}
        <div className="w-[450px] flex flex-col gap-4">
          {/* Avatar Stage Box */}
          <div className="flex-1 relative rounded-3xl border border-white/10 bg-slate-900/40 backdrop-blur-xl shadow-glass flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 text-xs text-slate-400 bg-slate-950/60 px-3 py-1 rounded-full border border-white/5 backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Live2D Interactive Viewport</span>
            </div>

            <Live2DCanvas state={state} emotion={emotion} width={420} height={440} />
          </div>

          {/* Quick Telemetry & Status Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>LLM Engine</span>
              </div>
              <div className="text-xs font-semibold text-slate-200 capitalize">
                {config.llm_provider || 'Ollama'}
              </div>
            </div>

            <div className="p-3 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Allowlist</span>
              </div>
              <div className="text-xs font-semibold text-slate-200">
                {config.allowlist?.allowed_applications?.length || 0} Apps Permitted
              </div>
            </div>

            <div className="p-3 rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-md">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
                <Activity className="w-3.5 h-3.5 text-purple-400" />
                <span>Wake Word</span>
              </div>
              <div className="text-xs font-semibold text-slate-200">
                "{config.wake_word || 'Snowman'}"
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Chat, Tool Calls & Timeline */}
        <div className="flex-1 flex flex-col h-full">
          <ChatDrawer
            messages={messages}
            onSendMessage={onSendMessage}
            onTriggerMic={onTriggerMic}
            isListening={state === 'listening'}
            latestAction={latestAction}
          />
        </div>
      </div>
    </div>
  );
};
