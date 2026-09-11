import React, { useState } from 'react';
import { SnowmanConfig, AllowlistConfig, AllowedApp } from '../types/assistant';
import { X, Save, Sliders, Shield, Cpu, Volume2, Plus, Trash2, Key } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: SnowmanConfig;
  onSaveConfig: (updatedConfig: Partial<SnowmanConfig>) => Promise<void>;
  onSaveAllowlist: (updatedAllowlist: AllowlistConfig) => Promise<void>;
  avatarStyle: 'neuro-brain' | 'live2d';
  onSaveAvatarStyle: (style: 'neuro-brain' | 'live2d') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  onSaveAllowlist,
  avatarStyle,
  onSaveAvatarStyle,
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'llm' | 'allowlist'>('general');
  const [selectedAvatar, setSelectedAvatar] = useState<'neuro-brain' | 'live2d'>(avatarStyle);
  const [assistantName, setAssistantName] = useState(config.assistant_name || 'Snowman');
  const [provider, setProvider] = useState(config.llm_provider || 'ollama');
  const [ollamaUrl, setOllamaUrl] = useState(config.ollama_base_url || 'http://localhost:11434');
  const [ollamaModel, setOllamaModel] = useState(config.ollama_model || 'llama3');
  const [groqKey, setGroqKey] = useState('');
  const [groqModel, setGroqModel] = useState(config.groq_model || 'openai/gpt-oss-120b');
  const [openaiKey, setOpenaiKey] = useState('');
  const [openaiModel, setOpenaiModel] = useState(config.openai_model || 'gpt-4o-mini');
  const [alwaysOnTop, setAlwaysOnTop] = useState(config.always_on_top);

  // Allowlist state
  const [allowlist, setAllowlist] = useState<AllowlistConfig>(config.allowlist);
  const [newAppAlias, setNewAppAlias] = useState('');
  const [newAppExec, setNewAppExec] = useState('');
  const [newDomain, setNewDomain] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const configUpdates: any = {
        ASSISTANT_NAME: assistantName,
        LLM_PROVIDER: provider,
        OLLAMA_BASE_URL: ollamaUrl,
        OLLAMA_MODEL: ollamaModel,
        GROQ_MODEL: groqModel,
        OPENAI_MODEL: openaiModel,
        ALWAYS_ON_TOP: alwaysOnTop,
      };

      if (groqKey.trim()) configUpdates.GROQ_API_KEY = groqKey.trim();
      if (openaiKey.trim()) configUpdates.OPENAI_API_KEY = openaiKey.trim();

      onSaveAvatarStyle(selectedAvatar);
      await onSaveConfig(configUpdates);
      await onSaveAllowlist(allowlist);
      onClose();
    } catch (e) {
      console.error('Error saving settings:', e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddApp = () => {
    if (!newAppAlias.trim() || !newAppExec.trim()) return;
    const newApp: AllowedApp = {
      alias: newAppAlias.trim().toLowerCase(),
      executable: newAppExec.trim(),
    };
    setAllowlist({
      ...allowlist,
      allowed_applications: [...allowlist.allowed_applications, newApp],
    });
    setNewAppAlias('');
    setNewAppExec('');
  };

  const handleRemoveApp = (alias: string) => {
    setAllowlist({
      ...allowlist,
      allowed_applications: allowlist.allowed_applications.filter((a) => a.alias !== alias),
    });
  };

  const handleAddDomain = () => {
    if (!newDomain.trim()) return;
    const cleanDomain = newDomain.trim().toLowerCase().replace(/^https?:\/\//, '');
    if (!allowlist.allowed_domains.includes(cleanDomain)) {
      setAllowlist({
        ...allowlist,
        allowed_domains: [...allowlist.allowed_domains, cleanDomain],
      });
    }
    setNewDomain('');
  };

  const handleRemoveDomain = (domain: string) => {
    setAllowlist({
      ...allowlist,
      allowed_domains: allowlist.allowed_domains.filter((d) => d !== domain),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-xl bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Settings</h2>
              <p className="text-[11px] text-slate-400">Configure Snowman AI engine and desktop integration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/10 bg-slate-950/20 px-6 gap-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            General & Voice
          </button>
          <button
            onClick={() => setActiveTab('llm')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'llm'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            LLM Brain Provider
          </button>
          <button
            onClick={() => setActiveTab('allowlist')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'allowlist'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Security Allowlist
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm text-slate-300">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Avatar Visual Style
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAvatar('neuro-brain');
                      onSaveAvatarStyle('neuro-brain');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedAvatar === 'neuro-brain'
                        ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-400/40'
                        : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                    }`}
                  >
                    <div className="font-semibold text-xs text-cyan-300 flex items-center justify-between">
                      <span>Neuro Brain</span>
                      <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded-full uppercase tracking-wider font-mono">Default</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Procedural 3D glowing bio-neural brain with real-time reactive pulses
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAvatar('live2d');
                      onSaveAvatarStyle('live2d');
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      selectedAvatar === 'live2d'
                        ? 'bg-cyan-950/40 border-cyan-400 text-cyan-200 shadow-md ring-1 ring-cyan-400/40'
                        : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-slate-200 hover:border-white/20'
                    }`}
                  >
                    <div className="font-semibold text-xs text-slate-200">
                      Classic Face (Live2D)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">
                      Humanoid anime-style face with lip-sync and expressive emotions
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Assistant Display Name
                </label>
                <input
                  type="text"
                  value={assistantName}
                  onChange={(e) => setAssistantName(e.target.value)}
                  className="w-full bg-slate-950/70 border border-white/10 rounded-xl px-3.5 py-2 text-slate-100 focus:outline-none focus:border-cyan-500/60"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl border border-white/10 bg-slate-950/40">
                <div>
                  <div className="font-medium text-slate-200 text-xs">Always On Top (Floating Overlay)</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">Keep assistant window pinned above other desktop apps</div>
                </div>
                <input
                  type="checkbox"
                  checked={alwaysOnTop}
                  onChange={(e) => setAlwaysOnTop(e.target.checked)}
                  className="w-4 h-4 rounded text-cyan-500 accent-cyan-500 cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-xl border border-white/10 bg-slate-950/40 space-y-2">
                <div className="font-medium text-slate-200 text-xs">Wake Word & VAD</div>
                <div className="text-xs text-slate-400">
                  Wake word detection triggers when saying <span className="text-cyan-300 font-mono">"Snowman"</span>.
                  Voice Activity Detection automatically senses when you finish speaking.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Primary LLM Provider
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['ollama', 'groq', 'openai'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setProvider(p)}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium capitalize transition-all ${
                        provider === p
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-sm'
                          : 'bg-slate-950/40 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {p === 'ollama' ? 'Ollama (Local)' : p}
                    </button>
                  ))}
                </div>
              </div>

              {provider === 'ollama' && (
                <div className="space-y-3 p-4 rounded-xl border border-white/10 bg-slate-950/40">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Ollama Base URL</label>
                    <input
                      type="text"
                      value={ollamaUrl}
                      onChange={(e) => setOllamaUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Model Name</label>
                    <input
                      type="text"
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                </div>
              )}

              {provider === 'groq' && (
                <div className="space-y-3 p-4 rounded-xl border border-white/10 bg-slate-950/40">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Groq API Key</label>
                    <input
                      type="password"
                      placeholder={config.has_groq_key ? '••••••••••••••••' : 'Enter Groq API Key (gsk_...)'}
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Model Name</label>
                    <input
                      type="text"
                      value={groqModel}
                      onChange={(e) => setGroqModel(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                </div>
              )}

              {provider === 'openai' && (
                <div className="space-y-3 p-4 rounded-xl border border-white/10 bg-slate-950/40">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">OpenAI API Key</label>
                    <input
                      type="password"
                      placeholder={config.has_openai_key ? '••••••••••••••••' : 'Enter OpenAI API Key (sk-...)'}
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Model Name</label>
                    <input
                      type="text"
                      value={openaiModel}
                      onChange={(e) => setOpenaiModel(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'allowlist' && (
            <div className="space-y-5">
              {/* Allowed Apps */}
              <div>
                <div className="text-xs font-semibold text-slate-200 mb-2">Permitted Desktop Applications</div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {allowlist.allowed_applications.map((app) => (
                    <div
                      key={app.alias}
                      className="flex items-center justify-between px-3 py-1.5 bg-slate-950/40 border border-white/5 rounded-lg text-xs"
                    >
                      <div>
                        <span className="font-semibold text-cyan-300">{app.alias}</span>
                        <span className="text-slate-500 ml-2 font-mono">({app.executable})</span>
                      </div>
                      <button
                        onClick={() => handleRemoveApp(app.alias)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Alias (e.g. vlc)"
                    value={newAppAlias}
                    onChange={(e) => setNewAppAlias(e.target.value)}
                    className="flex-1 bg-slate-950/70 border border-white/10 rounded-lg px-2.5 py-1 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Exe (vlc.exe)"
                    value={newAppExec}
                    onChange={(e) => setNewAppExec(e.target.value)}
                    className="flex-1 bg-slate-950/70 border border-white/10 rounded-lg px-2.5 py-1 text-xs"
                  />
                  <button
                    onClick={handleAddApp}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs flex items-center gap-1 border border-white/10"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* Allowed Domains */}
              <div className="pt-2 border-t border-white/10">
                <div className="text-xs font-semibold text-slate-200 mb-2">Permitted Web Domains</div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                  {allowlist.allowed_domains.map((dom) => (
                    <span
                      key={dom}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-slate-950/60 border border-white/10 text-slate-300"
                    >
                      {dom}
                      <button
                        onClick={() => handleRemoveDomain(dom)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    placeholder="Domain (e.g. bbc.com)"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    className="flex-1 bg-slate-950/70 border border-white/10 rounded-lg px-2.5 py-1 text-xs"
                  />
                  <button
                    onClick={handleAddDomain}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 rounded-lg text-xs flex items-center gap-1 border border-white/10"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-white/10 bg-slate-950/40">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl border border-white/10 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center gap-1.5 shadow-glow-cyan transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
