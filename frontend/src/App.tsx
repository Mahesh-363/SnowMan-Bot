import React, { useEffect, useState, useRef } from 'react';
import { AssistantState, AssistantEmotion, ChatMessage, SystemActionResult, SnowmanConfig, AllowlistConfig } from './types/assistant';
import { wsClient, getApiBaseUrl } from './services/websocket';
import { audioPlayer } from './services/audioPlayer';
import { voiceInput, MicState } from './services/voiceInput';
import { Live2DCanvas } from './components/Live2DCanvas';
import { NeuroBrainCanvas } from './components/NeuroBrainCanvas';
import { StateIndicator } from './components/StateIndicator';
import { EmotionBadge } from './components/EmotionBadge';
import { ClosedCaptions } from './components/ClosedCaptions';
import { ChatDrawer } from './components/ChatDrawer';
import { SettingsModal } from './components/SettingsModal';
import {
  Mic,
  MicOff,
  Sparkles,
  MessageSquare,
  Settings,
  Volume2,
  Subtitles,
  UserCheck,
  Globe,
  Calculator,
  Activity,
  Search,
  X
} from 'lucide-react';

export const App: React.FC = () => {
  const [state, setState] = useState<AssistantState>('idle');
  const [emotion, setEmotion] = useState<AssistantEmotion>('neutral');
  const [micState, setMicState] = useState<MicState>('off');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestAction, setLatestAction] = useState<SystemActionResult | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [showCC, setShowCC] = useState<boolean>(true);
  const [isWakingUp, setIsWakingUp] = useState<boolean>(false);
  const [detectedLanguage, setDetectedLanguage] = useState<string>('en');
  const [voiceGender, setVoiceGender] = useState<'female' | 'female_alt' | 'male'>('female');
  const [avatarStyle, setAvatarStyle] = useState<'neuro-brain' | 'live2d'>(() => {
    const saved = localStorage.getItem('snowman_avatar_style');
    return saved === 'live2d' ? 'live2d' : 'neuro-brain';
  });

  const handleSaveAvatarStyle = (style: 'neuro-brain' | 'live2d') => {
    setAvatarStyle(style);
    localStorage.setItem('snowman_avatar_style', style);
  };

  // AudioContext unlock on initial touch/click for mobile Safari & Chrome
  useEffect(() => {
    const handleGesture = () => {
      audioPlayer.unlockAudio();
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('touchstart', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('touchstart', handleGesture);
    };
  }, []);

  // Closed caption text tracking
  const [ccSpeaker, setCcSpeaker] = useState<string>('Snowman');
  const [ccText, setCcText] = useState<string>('Ready to talk! Click the microphone below or say "Snowman".');

  const [config, setConfig] = useState<SnowmanConfig>({
    assistant_name: 'Snowman',
    llm_provider: 'ollama',
    always_on_top: true,
    default_window_mode: 'full',
    allowlist: {
      allowed_applications: [],
      allowed_domains: [],
      allow_all_search_queries: true,
    },
    sites_mapping: {},
  });

  // Fetch initial config
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/config`);
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
          if (data.tts_voice && data.tts_voice.toLowerCase().includes('guy')) {
            setVoiceGender('male');
          } else {
            setVoiceGender('female');
          }
        }
      } catch (e) {
        console.warn(`Backend not yet reachable on ${getApiBaseUrl()}`);
      }
    }
    fetchConfig();
  }, []);

  const assistantNameRef = useRef<string>(config.assistant_name || 'Snowman');
  useEffect(() => {
    assistantNameRef.current = config.assistant_name || 'Snowman';
  }, [config.assistant_name]);

  // Initialize WebSocket & Voice (single stable connection)
  useEffect(() => {
    wsClient.connect();

    const unsubConn = wsClient.onConnectionChange((connected, wakingUp) => {
      setIsWakingUp(!!wakingUp);
    });

    const unsubState = wsClient.onStateChange((newState, newEmotion) => {
      setState(newState);
      if (newEmotion) setEmotion(newEmotion);
      if (newState === 'speaking' || newState === 'thinking') {
        voiceInput.setProcessing(true);
      } else if (newState === 'idle') {
        voiceInput.setProcessing(false);
      }
    });

    const unsubTranscript = wsClient.onTranscript((role, text, isFinal, lang) => {
      if (lang) setDetectedLanguage(lang);
      if (isFinal) {
        setMessages((prev) => [
          ...prev,
          {
            id: String(Date.now()),
            role,
            text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        if (role === 'user') {
          setCcSpeaker('You');
          setCcText(text);
        }
      }
    });

    const unsubLLM = wsClient.onLLMReply((text, replyEmotion, toolCall, lang) => {
      if (lang) setDetectedLanguage(lang);
      setEmotion(replyEmotion);
      setCcSpeaker(assistantNameRef.current);
      setCcText(text);
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'assistant',
          text,
          emotion: replyEmotion,
          toolCall,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    });

    const unsubAction = wsClient.onActionResult((result) => {
      setLatestAction(result);
      // Web browser execution: open URL directly in visitor's browser tab
      if (result.status === 'success' && result.details && result.details.url) {
        console.log('[App:WebAction] Launching URL in visitor browser:', result.details.url);
        try {
          window.open(result.details.url, '_blank', 'noopener,noreferrer');
        } catch (err) {
          console.warn('[App:WebAction] Pop-up blocked or error opening URL:', err);
        }
      }
    });

    const unsubAudio = wsClient.onAudioChunk((data, isFirst, isLast, genId) => {
      audioPlayer.handleAudioChunk(data, isFirst, isLast, genId);
    });

    // Wire real-time continuous microphone input with 3-state notification
    const unsubVoiceStatus = voiceInput.onStatusChange((newMicState) => {
      setMicState(newMicState);
      if (newMicState === 'listening') {
        setState('listening');
        setEmotion('happy');
        setCcSpeaker('You');
        setCcText('Always Listening (speak naturally anytime)...');
        wsClient.setState('listening', 'happy');
      } else if (newMicState === 'processing') {
        setState('thinking');
        setCcText('Processing your speech...');
      } else {
        setState((curr) => (curr === 'listening' ? 'idle' : curr));
      }
    });

    const unsubVoiceTranscript = voiceInput.onTranscript((transcript, isFinal) => {
      setCcSpeaker('You');
      setCcText(transcript);
      if (isFinal && transcript.trim()) {
        handleSendMessage(transcript.trim());
      }
    });

    const unsubPlayback = audioPlayer.onPlaybackStateChange((isPlaying) => {
      if (isPlaying) {
        setState('speaking');
        voiceInput.setProcessing(true);
      } else {
        setState((curr) => (curr === 'speaking' ? 'idle' : curr));
        voiceInput.setProcessing(false);
      }
    });

    const unsubVoiceError = voiceInput.onError((errorMsg) => {
      console.warn('[App:VAD] Voice pipeline error/timeout:', errorMsg);
      setCcSpeaker(assistantNameRef.current);
      setCcText("Sorry, I didn't catch that — try again.");
      setEmotion('confused');
      setTimeout(() => {
        setEmotion('neutral');
      }, 4500);
    });

    return () => {
      unsubConn();
      unsubState();
      unsubTranscript();
      unsubLLM();
      unsubAction();
      unsubAudio();
      unsubPlayback();
      unsubVoiceStatus();
      unsubVoiceTranscript();
      unsubVoiceError();
      voiceInput.stopContinuous();
      wsClient.disconnect();
    };
  }, []);

  const handleSendMessage = (text: string) => {
    wsClient.sendChat(text);
  };

  const handleTriggerMic = () => {
    audioPlayer.unlockAudio();
    voiceInput.requestMicrophonePermission();
    voiceInput.toggleContinuous();
  };

  const handleToggleVoiceGender = async () => {
    let nextGender: 'female' | 'female_alt' | 'male' = 'female';
    let sample = 'Hello! I am speaking with the Aria female studio voice.';
    if (voiceGender === 'female') {
      nextGender = 'female_alt';
      sample = 'Hello! I am now speaking with the Jenny female neural voice.';
    } else if (voiceGender === 'female_alt') {
      nextGender = 'male';
      sample = 'Hello! I am now speaking with the Guy male neural voice.';
    } else {
      nextGender = 'female';
      sample = 'Hello! I am now speaking with the Aria female studio voice.';
    }
    setVoiceGender(nextGender);
    try {
      await fetch(`${getApiBaseUrl()}/api/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voice: nextGender }),
      });
      wsClient.testSpeak(sample);
    } catch (e) {
      console.error('Error switching voice:', e);
    }
  };

  const handleSaveConfig = async (updated: Partial<SnowmanConfig>) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: updated }),
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, ...updated }));
      }
    } catch (e) {
      console.error('Failed to update config on backend:', e);
    }
  };

  const handleSaveAllowlist = async (updatedAllowlist: AllowlistConfig) => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/allowlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAllowlist),
      });
      if (res.ok) {
        setConfig((prev) => ({ ...prev, allowlist: updatedAllowlist }));
      }
    } catch (e) {
      console.error('Failed to update allowlist on backend:', e);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-slate-950 text-slate-100 overflow-hidden select-none flex flex-col">
      {/* Background Cyber Ambient Mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.18),rgba(255,255,255,0))] pointer-events-none" />
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[1px] pointer-events-none" />

      {/* Top Floating Glass Navigation Bar */}
      <header className="relative z-30 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60 backdrop-blur-xl">
        {/* Left: Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold shadow-glow-cyan text-base">
            S
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-white flex items-center gap-2">
              <span>{config.assistant_name || 'Snowman'}</span>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                Neural AI
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Multilingual AI Voice Assistant</div>
          </div>
        </div>

        {/* Center: State & Emotion Badge */}
        <div className="flex items-center gap-2.5">
          <StateIndicator state={state} micState={micState} onClick={handleTriggerMic} />
          <EmotionBadge emotion={emotion} />
        </div>

        {/* Right: Actions (Voice Gender Switcher, CC Toggle, Chat, Settings) */}
        <div className="flex items-center gap-2">
          {/* Multilingual Voice / Lang Tag */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-white/10 bg-slate-900/60 text-xs text-slate-300">
            <Globe className="w-3.5 h-3.5 text-cyan-400" />
            <span className={detectedLanguage === 'en' ? 'font-bold text-cyan-300' : 'text-slate-400'}>EN</span>
            <span className="text-slate-600">/</span>
            <span className={detectedLanguage === 'hi' ? 'font-bold text-amber-300' : 'text-slate-400'}>हिंदी</span>
            <span className="text-slate-600">/</span>
            <span className={detectedLanguage === 'te' ? 'font-bold text-teal-300' : 'text-slate-400'}>తెలుగు</span>
          </div>
          {/* Female / Male Voice Switcher */}
          <button
            onClick={handleToggleVoiceGender}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              voiceGender.startsWith('female')
                ? 'bg-rose-500/20 border-rose-400/50 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.3)]'
                : 'bg-sky-500/20 border-sky-400/50 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.3)]'
            }`}
            title="Toggle between Female (Aria / Jenny) and Male (Guy) neural voices"
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Voice: {voiceGender === 'female' ? 'Female (Aria)' : voiceGender === 'female_alt' ? 'Female (Jenny)' : 'Male (Guy)'}</span>
          </button>

          {/* Closed Captions Toggle Button */}
          <button
            onClick={() => setShowCC(!showCC)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              showCC
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle Closed Captions (Subtitles)"
          >
            <Subtitles className="w-3.5 h-3.5" />
            <span>CC</span>
          </button>

          {/* Test Speech Button */}
          <button
            onClick={() => wsClient.testSpeak("Hello! My neural speech and face animations are fully active.")}
            className="p-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Test Voice Playback"
          >
            <Volume2 className="w-4 h-4" />
          </button>

          {/* Toggle Chat Drawer Button */}
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
              isChatOpen
                ? 'bg-cyan-600 border-cyan-400 text-white'
                : 'bg-slate-900 border-white/10 text-slate-300 hover:border-cyan-500/30'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Log</span>
          </button>

          {/* Avatar Switcher Quick Toggle */}
          <button
            onClick={() => handleSaveAvatarStyle(avatarStyle === 'neuro-brain' ? 'live2d' : 'neuro-brain')}
            className="px-2.5 py-1.5 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors flex items-center gap-1.5 text-xs cursor-pointer"
            title={`Active: ${avatarStyle === 'neuro-brain' ? 'Neuro Brain (3D Three.js)' : 'Classic Face (Live2D)'}. Click to switch.`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline font-medium">
              {avatarStyle === 'neuro-brain' ? '3D Brain' : 'Classic Face'}
            </span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 rounded-xl border border-white/10 bg-slate-900/60 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Cloud Cold Start Spin-up Banner (Render Free Tier ~30s cold start) */}
      {isWakingUp && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-amber-950/90 border border-amber-500/50 backdrop-blur-xl text-amber-200 text-xs font-medium flex items-center gap-2.5 shadow-2xl animate-pulse">
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" />
          <span>Connecting to assistant (cloud server waking up from sleep, ~30s)...</span>
        </div>
      )}

      {/* Main Full-Page Stage: Avatar Model */}
      <main className="relative flex-1 w-full h-full flex flex-col items-center justify-center overflow-hidden">
        {/* Full-Page Stage: Swappable Avatar Canvas (Neuro Brain default vs Live2D) */}
        <div className="absolute inset-0 flex items-center justify-center">
          {avatarStyle === 'neuro-brain' ? (
            <NeuroBrainCanvas state={state} emotion={emotion} />
          ) : (
            <Live2DCanvas state={state} emotion={emotion} />
          )}
        </div>

        {/* Floating Bottom Controls: Quick Actions → Captions → Microphone */}
        <div className="absolute bottom-5 z-30 flex flex-col items-center gap-2.5 w-full max-w-2xl px-4 pointer-events-none">
          {/* Quick Voice Prompt Shortcuts */}
          <div className="pointer-events-auto flex items-center gap-2 bg-slate-950/80 border border-white/10 px-3 py-1.5 rounded-full backdrop-blur-md text-xs text-slate-300 shadow-xl overflow-x-auto max-w-full">
            <button
              onClick={() => handleSendMessage("open youtube")}
              className="px-2.5 py-0.5 rounded-full hover:bg-white/10 flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Globe className="w-3 h-3 text-rose-400" />
              <span>YouTube</span>
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={() => handleSendMessage("search for latest AI news")}
              className="px-2.5 py-0.5 rounded-full hover:bg-white/10 flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Search className="w-3 h-3 text-purple-400" />
              <span>Search News</span>
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={() => handleSendMessage("open github")}
              className="px-2.5 py-0.5 rounded-full hover:bg-white/10 flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Globe className="w-3 h-3 text-cyan-400" />
              <span>GitHub</span>
            </button>
            <span className="text-white/20">•</span>
            <button
              onClick={() => handleSendMessage("tell me an interesting science fact")}
              className="px-2.5 py-0.5 rounded-full hover:bg-white/10 flex items-center gap-1 transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Science Fact</span>
            </button>
          </div>

          {/* Closed Captions Subtitle Overlay (Horizontally Centered, between Quick Actions & Mic) */}
          <ClosedCaptions
            speaker={ccSpeaker}
            text={ccText}
            language={detectedLanguage}
            isVisible={showCC}
            isSpeaking={state === 'speaking'}
            isListening={state === 'listening'}
          />

          {/* Large Floating Interactive Microphone Button (3 Distinct States) */}
          <div className="pointer-events-auto relative flex flex-col items-center justify-center">
            {/* Listening state pinging auras */}
            {(micState === 'listening' || state === 'listening') && (
              <>
                <div className="absolute top-0 w-16 h-16 rounded-full bg-emerald-500/25 animate-ping pointer-events-none" />
                <div className="absolute top-0 w-20 h-20 -m-2 rounded-full border border-emerald-500/40 animate-pulse pointer-events-none" />
              </>
            )}

            {/* Processing state pulsing auras */}
            {(micState === 'processing' || state === 'thinking' || state === 'speaking') && (
              <>
                <div className="absolute top-0 w-16 h-16 rounded-full bg-purple-500/25 animate-ping pointer-events-none" />
                <div className="absolute top-0 w-20 h-20 -m-2 rounded-full border border-purple-500/40 animate-pulse pointer-events-none" />
              </>
            )}

            <button
              onClick={handleTriggerMic}
              className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-300 shadow-2xl cursor-pointer ${
                micState === 'processing' || state === 'thinking' || state === 'speaking'
                  ? 'bg-gradient-to-tr from-purple-600 to-indigo-500 border-purple-300 text-white shadow-[0_0_35px_rgba(168,85,247,0.5)] scale-105'
                  : micState === 'listening' || state === 'listening'
                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 border-emerald-300 text-white shadow-[0_0_35px_rgba(16,185,129,0.55)] scale-110'
                  : 'bg-slate-900/90 border-slate-700 hover:border-cyan-400 text-slate-400 hover:text-white shadow-xl hover:scale-105'
              }`}
              title={
                micState === 'listening' || state === 'listening'
                  ? 'Always Listening (Speak anytime • Click to turn off)'
                  : micState === 'processing' || state === 'thinking'
                  ? 'Processing captured phrase...'
                  : 'Microphone is off (Click to turn on always-listening)'
              }
            >
              {micState === 'processing' || state === 'thinking' || state === 'speaking' ? (
                <Sparkles className="w-7 h-7 animate-spin" />
              ) : micState === 'listening' || state === 'listening' ? (
                <Mic className="w-7 h-7 animate-pulse" />
              ) : (
                <MicOff className="w-7 h-7" />
              )}
            </button>

            {/* Sub-label showing current mic state */}
            <span
              className={`text-[11px] font-semibold mt-2 px-2.5 py-0.5 rounded-full border backdrop-blur-md transition-all ${
                micState === 'processing' || state === 'thinking' || state === 'speaking'
                  ? 'text-purple-300 bg-purple-950/80 border-purple-500/40 shadow-glow-purple'
                  : micState === 'listening' || state === 'listening'
                  ? 'text-emerald-300 bg-emerald-950/80 border-emerald-500/40 shadow-glow-emerald'
                  : 'text-slate-400 bg-slate-950/80 border-white/10'
              }`}
            >
              {micState === 'processing' || state === 'thinking' || state === 'speaking'
                ? 'Processing...'
                : micState === 'listening' || state === 'listening'
                ? 'Always Listening'
                : 'Mic: Off (Click to activate)'}
            </span>
          </div>
        </div>
      </main>

      {/* Slide-over Right Chat Drawer */}
      {isChatOpen && (
        <aside className="fixed top-0 sm:top-16 right-0 bottom-0 z-40 w-full sm:w-96 max-w-full bg-slate-950/95 sm:border-l border-white/10 backdrop-blur-2xl shadow-2xl animate-fadeIn flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <MessageSquare className="w-4 h-4 text-cyan-400" />
              <span>Conversation & Commands</span>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden p-2">
            <ChatDrawer
              messages={messages}
              onSendMessage={handleSendMessage}
              onTriggerMic={handleTriggerMic}
              isListening={state === 'listening'}
              latestAction={latestAction}
            />
          </div>
        </aside>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
        onSaveAllowlist={handleSaveAllowlist}
        avatarStyle={avatarStyle}
        onSaveAvatarStyle={handleSaveAvatarStyle}
      />
    </div>
  );
};
