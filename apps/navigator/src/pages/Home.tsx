import { Link } from 'react-router-dom';
import { processData } from '@/lib/data';
import searchChunksData from '@/data/search-chunks.json';
import SectorIcon from '@/components/SectorIcon';
import { Compass, Library, MessageCircle } from 'lucide-react';

export default function Home() {
  const { metadata, sectors, phases } = processData;
  const totalSearchable = searchChunksData.length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center mb-16 sm:mb-20">
        <h1 className="text-3xl sm:text-5xl font-bold text-black mb-4 tracking-irc-tight">
          Emergency Response Navigator
        </h1>
        <span className="block h-1 w-20 bg-irc-yellow mx-auto mt-4" />
        <p className="text-lg text-irc-gray-500 max-w-2xl mx-auto leading-relaxed mt-6">
          Navigate the response process, find resources, and get AI guidance.
          Built on IRC's Emergency Management Guidelines v2.0 and the Emergency Roadmap.
        </p>
      </div>

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

      {/* Classification Quick Start */}
      <div className="card p-5 mb-10">
        <h2 className="font-bold text-black mb-3 tracking-irc-tight">Start by Classification</h2>
        <p className="text-sm text-irc-gray-500 mb-4">
          Select your emergency classification to see the relevant tasks:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/navigator?classification=yellow"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-irc-yellow bg-yellow-50 hover:bg-yellow-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-irc-yellow flex items-center justify-center text-black font-bold text-sm shrink-0">
              Y
            </div>
            <div>
              <p className="font-bold text-black">Yellow</p>
              <p className="text-xs text-irc-gray-500">Country program leads and is capable of responding</p>
            </div>
          </Link>

          <Link
            to="/navigator?classification=orange"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-orange-300 bg-orange-50 hover:bg-orange-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-orange-400 flex items-center justify-center text-white font-bold text-sm shrink-0">
              O
            </div>
            <div>
              <p className="font-bold text-black">Orange</p>
              <p className="text-xs text-irc-gray-500">Additional assistance needed to ensure proportional response</p>
            </div>
          </Link>

          <Link
            to="/navigator?classification=red"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-irc-crisis-red bg-red-50 hover:bg-red-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-irc-crisis-red flex items-center justify-center text-white font-bold text-sm shrink-0">
              R
            </div>
            <div>
              <p className="font-bold text-irc-crisis-red">Red</p>
              <p className="text-xs text-irc-gray-500">All hands on deck — maximum organizational response</p>
            </div>
          </Link>
        </div>
      </div>

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
          {totalSearchable.toLocaleString()} knowledge chunks · {metadata.totalDownloadedDocs} indexed documents
          {' · '}Built {new Date(metadata.buildDate).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
