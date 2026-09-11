import { AssistantState, AssistantEmotion, SystemActionResult, ToolCall } from '../types/assistant';

export const getApiBaseUrl = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_WS_URL) {
    const wsUrl = import.meta.env.VITE_WS_URL.trim();
    const httpUrl = wsUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
    return httpUrl.replace(/\/ws\/?$/, '').replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return `https://${window.location.host}`;
  }
  return 'http://127.0.0.1:8765';
};

export const getWsUrl = (): string => {
  let url = import.meta.env.VITE_WS_URL;
  if (url) {
    url = url.trim();
    // Auto-normalize protocol if user passed https:// or http://
    if (url.startsWith('https://')) {
      url = 'wss://' + url.slice(8);
    } else if (url.startsWith('http://')) {
      url = 'ws://' + url.slice(7);
    }
    // Auto-append /ws endpoint if missing
    if (!url.endsWith('/ws')) {
      url = url.replace(/\/$/, '') + '/ws';
    }
    return url;
  }
  if (typeof window !== 'undefined') {
    if (window.location.protocol === 'https:') {
      return `wss://${window.location.host}/ws`;
    }
    if (window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `ws://${window.location.host}/ws`;
    }
  }
  return 'ws://127.0.0.1:8765/ws';
};

type StateChangeCallback = (state: AssistantState, emotion?: AssistantEmotion) => void;
type TranscriptCallback = (role: 'user' | 'assistant', text: string, isFinal: boolean, language?: string) => void;
type LLMReplyCallback = (text: string, emotion: AssistantEmotion, toolCall?: ToolCall, language?: string) => void;
type ActionResultCallback = (result: SystemActionResult) => void;
type AudioChunkCallback = (base64Data: string, isFirst: boolean, isLast: boolean, genId?: number) => void;
type ConnectionChangeCallback = (connected: boolean, isWakingUp?: boolean) => void;

class WebSocketClient {
  private socket: WebSocket | null = null;
  private url: string = getWsUrl();
  private reconnectInterval: number = 2500;
  private shouldReconnect: boolean = true;
  private isConnected: boolean = false;
  private isWakingUp: boolean = false;

  private stateChangeListeners: StateChangeCallback[] = [];
  private transcriptListeners: TranscriptCallback[] = [];
  private llmReplyListeners: LLMReplyCallback[] = [];
  private actionResultListeners: ActionResultCallback[] = [];
  private audioChunkListeners: AudioChunkCallback[] = [];
  private connectionListeners: ConnectionChangeCallback[] = [];
  private reconnectTimer: any = null;
  private disconnectTimer: any = null;
  private watchdogTimer: any = null;

  connect(url?: string) {
    if (url) this.url = url;
    this.shouldReconnect = true;

    // If StrictMode or component scheduled a disconnect, cancel it immediately
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }

    // Prevent duplicate sockets if one is already OPEN or in CONNECTING state
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING) {
        return;
      }
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Render free-tier cold start watchdog (fires after 3.5s of waiting for connection)
    if (this.watchdogTimer) clearTimeout(this.watchdogTimer);
    this.watchdogTimer = setTimeout(() => {
      if (!this.isConnected) {
        this.isWakingUp = true;
        this.notifyConnection(false, true);
      }
    }, 3500);

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        if (this.watchdogTimer) {
          clearTimeout(this.watchdogTimer);
          this.watchdogTimer = null;
        }
        this.isConnected = true;
        this.isWakingUp = false;
        this.notifyConnection(true, false);
        console.log('[WS] Connected to Snowman Backend');
      };

      this.socket.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleMessage(msg);
        } catch (e) {
          console.error('[WS] Failed to parse message JSON:', e);
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.notifyConnection(false, this.isWakingUp);
        this.socket = null;
        if (this.shouldReconnect && !this.reconnectTimer) {
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.connect();
          }, this.reconnectInterval);
        }
      };

      this.socket.onerror = () => {
        // Will trigger onclose automatically
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          try {
            this.socket.close();
          } catch (e) {}
        }
      };
    } catch (e) {
      console.error('[WS] Connection exception:', e);
      if (this.shouldReconnect && !this.reconnectTimer) {
        this.reconnectTimer = setTimeout(() => {
          this.reconnectTimer = null;
          this.connect();
        }, this.reconnectInterval);
      }
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.watchdogTimer) {
      clearTimeout(this.watchdogTimer);
      this.watchdogTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Debounce teardown so React StrictMode double-invoke does not abort handshake
    if (this.disconnectTimer) {
      clearTimeout(this.disconnectTimer);
    }
    this.disconnectTimer = setTimeout(() => {
      this.disconnectTimer = null;
      this.performActualDisconnect();
    }, 150);
  }

  private performActualDisconnect() {
    if (this.socket) {
      const s = this.socket;
      this.socket = null;
      // Strip handlers so intentional teardown doesn't log errors or attempt reconnect
      s.onopen = null;
      s.onmessage = null;
      s.onerror = null;
      s.onclose = null;
      try {
        if (s.readyState === WebSocket.CONNECTING) {
          s.onopen = () => {
            try {
              s.close();
            } catch (e) {}
          };
        } else if (s.readyState === WebSocket.OPEN) {
          s.close();
        }
      } catch (e) {}
    }
    this.isConnected = false;
    this.isWakingUp = false;
  }

  private handleMessage(msg: any) {
    const type = msg.type;

    if (type === 'state_change') {
      const state = msg.state as AssistantState;
      const emotion = msg.emotion as AssistantEmotion;
      this.stateChangeListeners.forEach(cb => cb(state, emotion));
    } else if (type === 'transcript') {
      this.transcriptListeners.forEach(cb => cb(msg.role, msg.text, msg.is_final, msg.language));
    } else if (type === 'llm_reply') {
      this.llmReplyListeners.forEach(cb => cb(msg.text, msg.emotion, msg.tool_call, msg.language));
    } else if (type === 'action_result') {
      this.actionResultListeners.forEach(cb => cb({
        tool: msg.tool,
        status: msg.status,
        message: msg.message,
        details: msg.details
      }));
    } else if (type === 'audio_chunk') {
      this.audioChunkListeners.forEach(cb => cb(msg.data, msg.is_first, msg.is_last, msg.gen_id));
    }
  }

  send(payload: Record<string, any>) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    } else {
      console.warn('[WS] Cannot send message, socket not connected');
    }
  }

  sendChat(text: string) {
    this.send({ type: 'chat', text });
  }

  setState(state: AssistantState, emotion?: AssistantEmotion) {
    this.send({ type: 'set_state', state, emotion });
  }

  requestStatus() {
    this.send({ type: 'get_status' });
  }

  testSpeak(text: string) {
    this.send({ type: 'test_speak', text });
  }

  // Listener subscriptions
  onStateChange(cb: StateChangeCallback) {
    this.stateChangeListeners.push(cb);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(l => l !== cb);
    };
  }

  onTranscript(cb: TranscriptCallback) {
    this.transcriptListeners.push(cb);
    return () => {
      this.transcriptListeners = this.transcriptListeners.filter(l => l !== cb);
    };
  }

  onLLMReply(cb: LLMReplyCallback) {
    this.llmReplyListeners.push(cb);
    return () => {
      this.llmReplyListeners = this.llmReplyListeners.filter(l => l !== cb);
    };
  }

  onActionResult(cb: ActionResultCallback) {
    this.actionResultListeners.push(cb);
    return () => {
      this.actionResultListeners = this.actionResultListeners.filter(l => l !== cb);
    };
  }

  onAudioChunk(cb: AudioChunkCallback) {
    this.audioChunkListeners.push(cb);
    return () => {
      this.audioChunkListeners = this.audioChunkListeners.filter(l => l !== cb);
    };
  }

  onConnectionChange(cb: ConnectionChangeCallback) {
    this.connectionListeners.push(cb);
    cb(this.isConnected, this.isWakingUp);
    return () => {
      this.connectionListeners = this.connectionListeners.filter(l => l !== cb);
    };
  }

  private notifyConnection(status: boolean, isWakingUp: boolean = false) {
    this.connectionListeners.forEach(cb => cb(status, isWakingUp));
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get wakingUp(): boolean {
    return this.isWakingUp;
  }
}

export const wsClient = new WebSocketClient();
