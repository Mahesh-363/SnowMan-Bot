import React, { useEffect, useState } from 'react';
import { Sparkles, Mic, Volume2 } from 'lucide-react';

interface ClosedCaptionsProps {
  speaker: string;
  text: string;
  language?: string;
  isVisible: boolean;
  isSpeaking: boolean;
  isListening?: boolean;
  className?: string;
}

export const ClosedCaptions: React.FC<ClosedCaptionsProps> = ({
  speaker,
  text,
  language = 'en',
  isVisible,
  isSpeaking,
  isListening = false,
  className = '',
}) => {
  const [activeText, setActiveText] = useState<string>('');
  const [activeSpeaker, setActiveSpeaker] = useState<string>('');
  const [visible, setVisible] = useState<boolean>(false);

  useEffect(() => {
    if (text.trim()) {
      setActiveText(text);
      setActiveSpeaker(speaker);
      setVisible(true);
    }
  }, [text, speaker]);

  // Keep captions visible during speech, plus a 5 second reading dwell time after speech stops
  useEffect(() => {
    if (!isSpeaking && !isListening && visible && activeText) {
      const timer = setTimeout(() => {
        setVisible(false);
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [isSpeaking, isListening, visible, activeText]);

  if (!isVisible || !visible || !activeText.trim()) return null;

  const isUser = activeSpeaker.toLowerCase() === 'you';

  return (
    <div className={`w-full max-w-xl pointer-events-auto transition-all duration-300 animate-fadeIn ${className}`}>
      <div className={`relative px-5 py-2.5 rounded-2xl backdrop-blur-2xl border shadow-2xl flex flex-col gap-1.5 ${
        isUser
          ? 'bg-slate-950/90 border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.25)]'
          : 'bg-slate-950/90 border-purple-500/40 shadow-[0_0_30px_rgba(168,85,247,0.3)]'
      }`}>
        {/* Speaker Badge & Audio Equalizer Indicator */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase px-2.5 py-0.5 rounded-full border ${
              isUser
                ? 'text-emerald-300 bg-emerald-950/70 border-emerald-500/50'
                : 'text-cyan-300 bg-cyan-950/70 border-cyan-500/50'
            }`}>
              {isUser ? <Mic className="w-3 h-3 text-emerald-400" /> : <Sparkles className="w-3 h-3 text-cyan-300" />}
              {activeSpeaker}
            </span>

            {/* Language Badge */}
            {language && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all ${
                  language.toLowerCase().startsWith('te')
                    ? 'bg-teal-950/80 border-teal-500/50 text-teal-300 shadow-[0_0_10px_rgba(20,184,166,0.3)]'
                    : language.toLowerCase().startsWith('hi')
                    ? 'bg-amber-950/80 border-amber-500/50 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                    : 'bg-sky-950/80 border-sky-500/40 text-sky-300'
                }`}
                title={`Language: ${
                  language.toLowerCase().startsWith('te')
                    ? 'Telugu (తెలుగు)'
                    : language.toLowerCase().startsWith('hi')
                    ? 'Hindi (हिंदी)'
                    : 'English'
                }`}
              >
                {language.toLowerCase().startsWith('te')
                  ? 'TE • తెలుగు'
                  : language.toLowerCase().startsWith('hi')
                  ? 'HI • हिंदी'
                  : 'EN'}
              </span>
            )}

            {isSpeaking && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-950/50 text-[10px] text-cyan-300 font-medium">
                <Volume2 className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span>Speaking</span>
                {/* Micro Audio Equalizer Waves */}
                <div className="flex items-end gap-0.5 h-3 ml-1">
                  <span className="w-0.5 h-2 bg-cyan-400 rounded-full animate-bounce" />
                  <span className="w-0.5 h-3 bg-cyan-300 rounded-full animate-pulse" />
                  <span className="w-0.5 h-1.5 bg-cyan-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}

            {isListening && isUser && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-950/50 text-[10px] text-emerald-300 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Listening...</span>
              </div>
            )}
          </div>

          <span className="text-[10px] text-slate-400 font-mono tracking-wider uppercase">
            Closed Captions
          </span>
        </div>

        {/* Real-time Spoken Caption Text (Horizontally Centered, Clear & Legible) */}
        <p className="text-sm sm:text-base text-slate-100 font-medium leading-relaxed drop-shadow-md text-center">
          {activeText}
        </p>
      </div>
    </div>
  );
};
