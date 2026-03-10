import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCountries } from '@/data/countries';
import { useClassification, type Stance } from '@/context/ClassificationContext';
import { Search, X, MapPin, ChevronRight } from 'lucide-react';

const STANCE_COLORS: Record<Stance, { bg: string; border: string; text: string; dot: string; hoverBg: string }> = {
  yellow: { bg: 'bg-yellow-50', border: 'border-irc-yellow', text: 'text-black', dot: 'bg-irc-yellow', hoverBg: 'hover:bg-yellow-100' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-black', dot: 'bg-orange-400', hoverBg: 'hover:bg-orange-100' },
  red:    { bg: 'bg-red-50', border: 'border-irc-crisis-red', text: 'text-irc-crisis-red', dot: 'bg-irc-crisis-red', hoverBg: 'hover:bg-red-100' },
};

function formatAffected(n: number | null): string {
  if (!n) return '';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M affected`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K affected`;
  return `${n} affected`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export default function CountrySearch() {
  const navigate = useNavigate();
  const {
    country, stance, classification, countryClassifications,
    isLoading, fetchError,
    selectCountry, selectClassification, selectStanceDirectly, clearClassification,
  } = useClassification();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Search as user types
  useEffect(() => {
    if (query.length > 0) {
      const matches = searchCountries(query).slice(0, 8);
      setResults(matches);
      setShowDropdown(matches.length > 0);
      setHighlightIdx(-1);
    } else {
      setResults([]);
      setShowDropdown(false);
    }
  }, [query]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectCountry = useCallback((name: string) => {
    setQuery('');
    setShowDropdown(false);
    selectCountry(name);
  }, [selectCountry]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx(prev => Math.min(prev + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleSelectCountry(results[highlightIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    clearClassification();
    inputRef.current?.focus();
  };

  const handleNavigate = () => {
    if (stance) {
      navigate(`/navigator?classification=${stance}`);
    } else {
      navigate('/navigator');
    }
  };

  const stanceLabel = stance ? stance.charAt(0).toUpperCase() + stance.slice(1) : '';

  // Manual stance buttons (used when no country or no classifications found)
  const StanceButtons = () => (
    <div className="grid grid-cols-3 gap-2 mt-3">
      {(['yellow', 'orange', 'red'] as Stance[]).map(s => {
        const colors = STANCE_COLORS[s];
        const isActive = stance === s && !classification;
        return (
          <button
            key={s}
            onClick={() => selectStanceDirectly(s)}
            className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border-2 transition-colors ${
              isActive
                ? `${colors.bg} ${colors.border} font-bold`
                : `border-irc-gray-200 hover:${colors.border} ${colors.hoverBg}`
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${colors.dot}`} />
            <span className={`text-sm font-medium ${isActive ? colors.text : 'text-irc-gray-700'}`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="card p-5 mb-10">
      <h2 className="font-bold text-black mb-3 tracking-irc-tight">Where are you responding?</h2>

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-irc-gray-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={country ? country : query}
            onChange={e => {
              if (country) {
                clearClassification();
              }
              setQuery(e.target.value);
            }}
            onFocus={() => {
              if (!country && query.length > 0 && results.length > 0) {
                setShowDropdown(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search for a country..."
            className="w-full pl-9 pr-9 py-2.5 border border-irc-gray-200 rounded-lg text-sm focus:outline-none focus:border-irc-yellow focus:ring-1 focus:ring-irc-yellow transition-colors"
            role="combobox"
            aria-expanded={showDropdown}
            aria-autocomplete="list"
            aria-controls="country-listbox"
          />
          {(country || query) && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-irc-gray-400 hover:text-black transition-colors"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown */}
        {showDropdown && (
          <div
            ref={dropdownRef}
            id="country-listbox"
            role="listbox"
            className="absolute z-50 w-full mt-1 bg-white border border-irc-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto"
          >
            {results.map((name, i) => (
              <button
                key={name}
                role="option"
                aria-selected={i === highlightIdx}
                onClick={() => handleSelectCountry(name)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
                  i === highlightIdx ? 'bg-yellow-50 text-black' : 'hover:bg-irc-gray-50 text-irc-gray-700'
                }`}
              >
                <MapPin className="w-3.5 h-3.5 text-irc-gray-400 shrink-0" />
                {name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Country selected: show classifications */}
      {country && !isLoading && (
        <div className="mt-4">
          {countryClassifications.length === 0 ? (
            /* State D: No active classifications */
            <div>
              <p className="text-sm text-irc-gray-500 mb-1">
                {fetchError
                  ? 'Unable to load classifications. You can still select manually:'
                  : `No active classifications found for ${country}.`}
              </p>
              {!fetchError && (
                <p className="text-sm text-irc-gray-400 mb-2">
                  You can still browse all tasks or select manually:
                </p>
              )}
              <StanceButtons />
              {stance && (
                <button
                  onClick={handleNavigate}
                  className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white font-medium text-sm hover:bg-irc-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                  Browse All Tasks
                </button>
              )}
            </div>
          ) : countryClassifications.length === 1 ? (
            /* State C: Single classification — auto-selected */
            <div>
              <div className={`rounded-lg border-2 p-4 ${STANCE_COLORS[stance || 'yellow'].border} ${STANCE_COLORS[stance || 'yellow'].bg}`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-3 h-3 rounded-full ${STANCE_COLORS[stance || 'yellow'].dot}`} />
                  <span className="font-bold text-sm">{stanceLabel}</span>
                  <span className="text-xs text-irc-gray-500">
                    · {formatDate(countryClassifications[0].date)}
                    {countryClassifications[0].codeNumber && ` · ${countryClassifications[0].codeNumber}`}
                    {countryClassifications[0].hazardType && ` · ${countryClassifications[0].hazardType}`}
                  </span>
                </div>
                <p className="text-xs text-irc-gray-500">
                  Severity {countryClassifications[0].severity}
                  {countryClassifications[0].totalAffected ? ` · ${formatAffected(countryClassifications[0].totalAffected)}` : ''}
                </p>
              </div>
              <button
                onClick={handleNavigate}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white font-medium text-sm hover:bg-irc-gray-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
                View {stanceLabel} Tasks in Navigator
              </button>
            </div>
          ) : (
            /* State B: Multiple classifications */
            <div>
              <p className="text-sm font-medium text-irc-gray-700 mb-2">
                Active Classifications for {country}
              </p>
              <div className="border border-irc-gray-200 rounded-lg divide-y divide-irc-gray-200 overflow-hidden">
                {countryClassifications.map(cls => {
                  const clsStance = cls.stance?.toLowerCase() as Stance;
                  const colors = STANCE_COLORS[clsStance] || STANCE_COLORS.yellow;
                  const isSelected = classification?.id === cls.id;
                  return (
                    <button
                      key={cls.id}
                      onClick={() => selectClassification(cls)}
                      className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors ${
                        isSelected ? colors.bg : 'hover:bg-irc-gray-50'
                      }`}
                    >
                      <span className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? colors.border : 'border-irc-gray-300'
                      }`}>
                        {isSelected && <span className={`w-2 h-2 rounded-full ${colors.dot}`} />}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{formatDate(cls.date)}</span>
                          {cls.codeNumber && <span className="text-xs text-irc-gray-400">{cls.codeNumber}</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {cls.hazardType && <span className="text-xs text-irc-gray-500">{cls.hazardType}</span>}
                          <span className="flex items-center gap-1 text-xs">
                            <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                            {clsStance.charAt(0).toUpperCase() + clsStance.slice(1)}
                          </span>
                          <span className="text-xs text-irc-gray-400">
                            Severity {cls.severity}
                            {cls.totalAffected ? ` · ${formatAffected(cls.totalAffected)}` : ''}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {stance && (
                <button
                  onClick={handleNavigate}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white font-medium text-sm hover:bg-irc-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                  View {stanceLabel} Tasks in Navigator
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {country && isLoading && (
        <div className="mt-4 text-sm text-irc-gray-400 animate-pulse">
          Loading classifications...
        </div>
      )}

      {/* No country selected: show fallback stance buttons */}
      {!country && (
        <div className="mt-3">
          <p className="text-sm text-irc-gray-500 mb-2">Or select a classification directly:</p>
          <StanceButtons />
          {stance && !country && (
            <button
              onClick={handleNavigate}
              className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-black text-white font-medium text-sm hover:bg-irc-gray-700 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              View {stanceLabel} Tasks in Navigator
            </button>
          )}
        </div>
      )}
    </div>
  );
}
