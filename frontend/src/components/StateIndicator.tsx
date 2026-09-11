import React from 'react';
import { AssistantState } from '../types/assistant';
import { MicState } from '../services/voiceInput';
import { MicOff, BrainCircuit, Volume2, Radio } from 'lucide-react';

interface StateIndicatorProps {
  state: AssistantState;
  micState?: MicState;
  onClick?: () => void;
}

export const StateIndicator: React.FC<StateIndicatorProps> = ({ state, micState, onClick }) => {
  const activeMicState = micState || (state === 'listening' ? 'listening' : state === 'thinking' || state === 'speaking' ? 'processing' : 'off');

  const getBadgeConfig = () => {
    // 1. Processing / Active Speech
    if (activeMicState === 'processing' || state === 'thinking' || state === 'speaking') {
      if (state === 'speaking') {
        return {
          label: 'Speaking...',
          color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.35)]',
          dot: 'bg-cyan-400 animate-ping',
          icon: <Volume2 className="w-3.5 h-3.5 text-cyan-300" />,
          title: 'Snowman is speaking response',
        };
      }
      return {
        label: 'Processing...',
        color: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.35)]',
        dot: 'bg-purple-400 animate-pulse',
        icon: <BrainCircuit className="w-3.5 h-3.5 text-purple-300 animate-spin" />,
        title: 'Processing speech / executing action...',
      };
    }

    // 2. Continuous Always-Listening
    if (activeMicState === 'listening') {
      return {
        label: 'Always Listening',
        color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.35)]',
        dot: 'bg-emerald-400 animate-ping',
        icon: <Radio className="w-3.5 h-3.5 text-emerald-300 animate-pulse" />,
        title: 'Continuous listening active (Speak anytime • Click to turn off)',
      };
    }

    // 3. Off (Mic disabled)
    return {
      label: 'Mic: Off',
      color: 'bg-slate-900/80 text-slate-400 border-white/10 hover:border-cyan-500/30 hover:text-slate-200',
      dot: 'bg-slate-500',
      icon: <MicOff className="w-3.5 h-3.5 text-slate-400" />,
      title: 'Microphone is off (Click to turn on continuous listening)',
    };
  };

  const { label, color, dot, icon, title } = getBadgeConfig();

  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md transition-all duration-300 cursor-pointer ${color}`}
    >
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {icon}
      <span>{label}</span>
    </button>
  );
};
