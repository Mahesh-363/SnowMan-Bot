import React from 'react';
import { AssistantEmotion } from '../types/assistant';
import { Smile, HelpCircle, Minus } from 'lucide-react';

interface EmotionBadgeProps {
  emotion: AssistantEmotion;
}

export const EmotionBadge: React.FC<EmotionBadgeProps> = ({ emotion }) => {
  const getEmotionDetails = () => {
    switch (emotion) {
      case 'happy':
        return {
          label: 'Happy',
          icon: <Smile className="w-3.5 h-3.5 text-emerald-400" />,
          color: 'text-emerald-300 bg-emerald-950/40 border-emerald-500/30'
        };
      case 'confused':
        return {
          label: 'Confused',
          icon: <HelpCircle className="w-3.5 h-3.5 text-amber-400" />,
          color: 'text-amber-300 bg-amber-950/40 border-amber-500/30'
        };
      case 'neutral':
      default:
        return {
          label: 'Neutral',
          icon: <Minus className="w-3.5 h-3.5 text-cyan-400" />,
          color: 'text-slate-300 bg-slate-900/40 border-white/10'
        };
    }
  };

  const { label, icon, color } = getEmotionDetails();

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border backdrop-blur-xs ${color}`}>
      {icon}
      <span>{label}</span>
    </div>
  );
};
