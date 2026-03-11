import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { processData } from '@/lib/data';
import SectorIcon from '@/components/SectorIcon';
import CountrySearch from '@/components/CountrySearch';
import { Compass, Library, MessageCircle, User } from 'lucide-react';

const ROLE_SECTORS: Record<string, string[]> = {
  'Response Management': ['response_mgmt'],
  'Finance': ['finance'],
  'Logistics / Supply Chain': ['supply_chain'],
  'People & Culture (HR)': ['people_culture'],
  'Safety & Security': ['safety_security'],
  'Technical Programs': ['technical'],
  'MEAL': ['meal'],
  'Grants': ['grants'],
  'Partnerships': ['partnerships'],
};

const ROLE_STORAGE_KEY = 'ern-user-role';

export default function Home() {
  const { metadata, sectors, phases } = processData;
  const [selectedRole, setSelectedRole] = useState<string | null>(() => localStorage.getItem(ROLE_STORAGE_KEY));

  useEffect(() => {
    if (selectedRole) localStorage.setItem(ROLE_STORAGE_KEY, selectedRole);
    else localStorage.removeItem(ROLE_STORAGE_KEY);
  }, [selectedRole]);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Quick Start — bold card trio */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-14">
        {/* Process Navigator — white accent card */}
        <Link
          to="/navigator"
          className="bg-white rounded-xl border-l-4 border-irc-yellow shadow-sm p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-irc-gray-100 flex items-center justify-center mb-3">
            <Compass className="w-5 h-5 text-irc-gray-700" />
          </div>
          <h3 className="font-bold text-black group-hover:text-irc-gray-700 transition-colors tracking-irc-tight">
            Process Navigator
          </h3>
          <p className="text-sm text-irc-gray-500 mt-1">
            {metadata.totalTasks} tasks across {metadata.totalSectors} sectors and {phases.length} response phases
          </p>
        </Link>

        {/* Resource Library — white accent card */}
        <Link
          to="/resources"
          className="bg-white rounded-xl border-l-4 border-irc-yellow shadow-sm p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-irc-gray-100 flex items-center justify-center mb-3">
            <Library className="w-5 h-5 text-irc-gray-700" />
          </div>
          <h3 className="font-bold text-black group-hover:text-irc-gray-700 transition-colors tracking-irc-tight">
            Resource Library
          </h3>
          <p className="text-sm text-irc-gray-500 mt-1">
            {metadata.totalResourcesWithUrls} linked documents — templates, policies, guidance, SOPs
          </p>
        </Link>

        {/* AI Advisor — white accent card */}
        <div
          className="bg-white rounded-xl border-l-4 border-irc-yellow shadow-sm p-5 hover:-translate-y-0.5 hover:shadow-lg transition-all group cursor-pointer"
          onClick={() => document.querySelector<HTMLButtonElement>('[title="Ask Albert"]')?.click()}
        >
          <div className="w-10 h-10 rounded-lg bg-irc-gray-100 flex items-center justify-center mb-3">
            <MessageCircle className="w-5 h-5 text-irc-gray-700" />
          </div>
          <h3 className="font-bold text-black group-hover:text-irc-gray-700 transition-colors tracking-irc-tight">
            Ask Albert
          </h3>
          <p className="text-sm text-irc-gray-500 mt-1">
            AI-powered Q&A backed by {metadata.totalDownloadedDocs} indexed documents
          </p>
        </div>
      </div>

      {/* 3B: Role-Based Quick Start */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-black tracking-irc-tight flex items-center gap-2">
            <User className="w-4 h-4 text-irc-gray-500" />
            What's your role?
          </h2>
          {selectedRole && (
            <button onClick={() => setSelectedRole(null)} className="text-xs text-irc-gray-500 hover:text-black">Clear</button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.keys(ROLE_SECTORS).map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(selectedRole === role ? null : role)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedRole === role
                  ? 'bg-black text-white'
                  : 'border border-irc-gray-200 text-irc-gray-500 hover:border-irc-yellow hover:bg-yellow-50'
              }`}
            >
              {role}
            </button>
          ))}
        </div>
        {selectedRole && ROLE_SECTORS[selectedRole] && (
          <div className="mt-3 pt-3 border-t border-irc-gray-200">
            <p className="text-xs text-irc-gray-500 mb-2">Quick access to your key tasks:</p>
            <div className="flex flex-wrap gap-2">
              {ROLE_SECTORS[selectedRole].map(sectorId => {
                const sector = sectors.find(s => s.id === sectorId);
                if (!sector) return null;
                return (
                  <Link
                    key={sectorId}
                    to={`/navigator/${sectorId}?phase=R1`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-yellow-50 border border-irc-yellow text-sm font-medium text-black hover:bg-yellow-100 transition-colors"
                  >
                    <SectorIcon sectorId={sectorId} className="w-4 h-4" />
                    {sector.name} — R1 Key Tasks
                  </Link>
                );
              })}
              <Link
                to={`/navigator/${ROLE_SECTORS[selectedRole][0]}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-irc-gray-200 text-sm text-irc-gray-700 hover:bg-irc-gray-50 transition-colors"
              >
                View all phases
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Country Search + Classification Picker */}
      <CountrySearch />

      {/* Response Phases Overview — 2-col grid, compact */}
      <div className="card p-5 mb-10">
        <h2 className="font-bold text-black mb-4 tracking-irc-tight">Response Phases</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {phases.map(phase => (
            <Link
              key={phase.id}
              to={`/navigator?phase=${phase.id}`}
              className="flex items-center gap-3 p-3 rounded-lg hover:bg-irc-gray-50 transition-colors"
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${
                phase.id === 'R1' ? 'bg-irc-crisis-red' :
                phase.id === 'R2' ? 'bg-irc-yellow' :
                phase.id === 'R3' ? 'bg-irc-yellow-light' :
                phase.id === 'R4' ? 'bg-irc-gray-700' :
                phase.id === 'R5' ? 'bg-irc-gray-500' :
                phase.id === 'R6' ? 'bg-irc-gray-400' :
                'bg-irc-gray-200'
              }`}>
                {phase.id.replace('R', '')}
              </div>
              <div>
                <p className="font-medium text-sm text-black">{phase.id}: {phase.name}</p>
                <p className="text-xs text-irc-gray-400 mt-0.5">{phase.timeline}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Sectors Grid */}
      <div className="card p-5">
        <h2 className="font-bold text-black mb-4 tracking-irc-tight">Functional Sectors</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {sectors.map(sector => (
            <Link
              key={sector.id}
              to={`/navigator/${sector.id}`}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-irc-gray-200 hover:border-irc-yellow hover:bg-yellow-50 transition-colors"
            >
              <SectorIcon sectorId={sector.id} className="w-4 h-4 text-irc-gray-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-irc-gray-700 truncate">{sector.name}</p>
                <p className="text-xs text-irc-gray-400">{sector.tasks.length} tasks</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Stats footer */}
      <div className="mt-10 text-center text-xs text-irc-gray-400">
        <p>
          4,005 knowledge chunks · {metadata.totalDownloadedDocs} indexed documents
          {' · '}Built {new Date(metadata.buildDate).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
