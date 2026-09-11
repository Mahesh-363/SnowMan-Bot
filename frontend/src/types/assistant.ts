export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

export type AssistantEmotion = 'neutral' | 'happy' | 'confused';

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  emotion?: AssistantEmotion;
  timestamp: string;
  toolCall?: ToolCall;
}

export interface SystemActionResult {
  tool: string;
  status: 'success' | 'blocked' | 'error' | 'not_found' | string;
  message: string;
  details?: Record<string, any>;
}

export interface AllowedApp {
  alias: string;
  executable: string;
  description?: string;
}

export interface AllowlistConfig {
  allowed_applications: AllowedApp[];
  allowed_domains: string[];
  allow_all_search_queries: boolean;
}

export interface SnowmanConfig {
  assistant_name: string;
  llm_provider: 'ollama' | 'groq' | 'openai' | string;
  ollama_base_url?: string;
  ollama_model?: string;
  groq_model?: string;
  has_groq_key?: boolean;
  openai_model?: string;
  has_openai_key?: boolean;
  whisper_model_size?: string;
  wake_word?: string;
  wake_word_engine?: string;
  always_on_top: boolean;
  default_window_mode: 'overlay' | 'full';
  allowlist: AllowlistConfig;
  sites_mapping: Record<string, string>;
}
