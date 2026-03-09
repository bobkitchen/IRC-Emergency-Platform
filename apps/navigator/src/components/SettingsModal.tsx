import { useState, useEffect } from 'react';
import { getApiKey, getModel, setModel, MODELS, type ModelOption } from '@/lib/chat';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const TIER_LABELS: Record<ModelOption['tier'], { label: string; color: string; desc: string }> = {
  standard: { label: '● Standard', color: 'text-blue-600', desc: 'Great balance of quality and cost' },
};

export default function SettingsModal({ isOpen, onClose }: Props) {
  const [selectedModel, setSelectedModel] = useState('google/gemini-2.5-flash');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedModel(getModel());
      setSaved(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    setModel(selectedModel);
    setSaved(true);
    setTimeout(() => onClose(), 800);
  };

  const hasKey = !!getApiKey();
  const selectedModelInfo = MODELS.find(m => m.id === selectedModel);
  const tiers: ModelOption['tier'][] = ['standard', 'free'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-black tracking-irc-tight">Settings</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-irc-gray-100">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {hasKey ? (
            <p className="text-xs text-green-700 bg-green-50 rounded-md px-3 py-2">
              API key is pre-configured. No setup needed.
            </p>
          ) : (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2">
              No API key configured. Ask the admin for a deployed version or set <code>VITE_OPENROUTER_KEY</code> in your environment.
            </p>
          )}

          <div>
            <label className="block text-sm font-medium text-irc-gray-700 mb-1">
              AI Model
            </label>
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 border border-irc-gray-200 rounded-md text-sm focus:ring-2 focus:ring-irc-yellow focus:border-transparent"
            >
              {tiers.map(tier => {
                const tierModels = MODELS.filter(m => m.tier === tier);
                if (tierModels.length === 0) return null;
                const info = TIER_LABELS[tier];
                return (
                  <optgroup key={tier} label={`${info.label} — ${info.desc}`}>
                    {tierModels.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
            {selectedModelInfo && (
              <p className="mt-1 text-xs text-irc-gray-500">
                <span className={TIER_LABELS[selectedModelInfo.tier].color + ' font-medium'}>
                  {TIER_LABELS[selectedModelInfo.tier].label}
                </span>
                {' — '}
                {selectedModelInfo.description}
              </p>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={saved}
            className={`w-full py-2 rounded-md text-sm font-bold transition-colors ${
              saved
                ? 'bg-black text-irc-yellow'
                : 'bg-irc-yellow text-black hover:bg-irc-yellow-light'
            }`}
          >
            {saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
