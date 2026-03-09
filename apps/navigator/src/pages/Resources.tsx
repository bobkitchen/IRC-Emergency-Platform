import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { processData } from '@/lib/data';
import resourceIndex from '@/data/resource-index.json';
import { FileText, Sheet, Presentation, Archive, File, Paperclip } from 'lucide-react';

interface ResourceEntry {
  name: string;
  url: string;
  sector: string;
  task: string;
}

// Build a unified resource list from all sources
function buildAllResources() {
  const all: Array<{
    name: string;
    url: string;
    sector: string;
    context: string;
    source: 'task' | 'annex' | 'emu' | 'preparedness';
    type?: string;
    fileType?: string;
  }> = [];

  const seen = new Set<string>();

  // 1. Task-level resources with URLs (from resource-index.json — deduplicated, with real URLs)
  for (const r of (resourceIndex as ResourceEntry[])) {
    const key = r.url.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      const ext = r.name.match(/\.(\w+)$/)?.[1]?.toLowerCase() || guessFileType(r.url, r.name);
      all.push({
        name: r.name,
        url: r.url,
        sector: r.sector,
        context: r.task,
        source: 'task',
        fileType: ext,
      });
    }
  }

  // 2. Annexes
  for (const a of processData.annexes) {
    const name = a.name;
    if (!seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      all.push({
        name,
        url: '',
        sector: 'Guidelines',
        context: `Annex · ${a.type}`,
        source: 'annex',
        type: a.type,
        fileType: a.fileType,
      });
    }
  }

  // 3. EmU Services
  for (const s of processData.emuServices) {
    all.push({
      name: s.name,
      url: s.link && (s.link.startsWith('http') || s.link.startsWith('mailto')) ? s.link : '',
      sector: 'Emergency Unit',
      context: s.description || 'EmU Service',
      source: 'emu',
    });
  }

  // 4. Preparedness Library
  for (const p of processData.preparednessLibrary) {
    const pUrl = p.link && (p.link.startsWith('http') || p.link.startsWith('mailto')) ? p.link : '';
    if (pUrl && !seen.has(pUrl.toLowerCase())) {
      seen.add(pUrl.toLowerCase());
      all.push({
        name: p.name,
        url: pUrl,
        sector: 'Preparedness',
        context: p.category,
        source: 'preparedness',
      });
    } else if (!pUrl) {
      all.push({
        name: p.name,
        url: '',
        sector: 'Preparedness',
        context: p.category,
        source: 'preparedness',
      });
    }
  }

  return all;
}

function guessFileType(url: string, name: string): string {
  const combined = `${url} ${name}`.toLowerCase();
  if (combined.includes('.pdf')) return 'pdf';
  if (combined.includes('.docx') || combined.includes('.doc')) return 'docx';
  if (combined.includes('.xlsx') || combined.includes('.xlsm') || combined.includes('.xls')) return 'xlsx';
  if (combined.includes('.pptx') || combined.includes('.ppt')) return 'pptx';
  if (combined.includes('.zip')) return 'zip';
  return '';
}

function getFileIcon(fileType?: string): React.ReactNode {
  const base = 'w-5 h-5 shrink-0';
  switch (fileType) {
    case 'pdf': return <FileText className={`${base} text-red-600`} />;
    case 'docx': case 'doc': return <FileText className={`${base} text-blue-600`} />;
    case 'xlsx': case 'xlsm': case 'xls': return <Sheet className={`${base} text-green-600`} />;
    case 'pptx': case 'ppt': return <Presentation className={`${base} text-orange-500`} />;
    case 'zip': return <Archive className={`${base} text-irc-gray-500`} />;
    default: return <File className={`${base} text-irc-gray-400`} />;
  }
}

function getSectorColor(sector: string): string {
  const colors: Record<string, string> = {
    'Emergency Unit': 'bg-irc-gray-100 text-irc-crisis-red',
    'Response Management': 'bg-yellow-50 text-yellow-800',
    'Guidelines': 'bg-irc-gray-100 text-irc-gray-700',
  };
  return colors[sector] || 'bg-irc-gray-100 text-irc-gray-700 font-semibold';
}

export default function Resources() {
  const [search, setSearch] = useState('');
  const [sectorFilter, setSectorFilter] = useState('all');
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'unlinked'>('all');

  const allResources = useMemo(() => buildAllResources(), []);

  const sectors = useMemo(() => {
    const s = [...new Set(allResources.map(r => r.sector))].sort();
    return s;
  }, [allResources]);

  const filtered = useMemo(() => {
    return allResources.filter(r => {
      if (sectorFilter !== 'all' && r.sector !== sectorFilter) return false;
      if (linkFilter === 'linked' && !r.url) return false;
      if (linkFilter === 'unlinked' && r.url) return false;
      if (search) {
        const q = search.toLowerCase();
        return r.name.toLowerCase().includes(q) ||
               r.sector.toLowerCase().includes(q) ||
               r.context.toLowerCase().includes(q);
      }
      return true;
    });
  }, [allResources, search, sectorFilter, linkFilter]);

  const linkedCount = allResources.filter(r => r.url).length;
  const totalCount = allResources.length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-irc-gray-500 mb-1">
        <Link to="/" className="hover:text-black">Home</Link>
        <span>/</span>
        <span className="text-black font-medium">Resources</span>
      </div>

      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-xl sm:text-2xl font-bold text-black tracking-irc-tight">Resource Library</h1>
        <p className="text-sm text-irc-gray-500">
          {totalCount} resources · {linkedCount} with links
        </p>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-irc-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search resources..."
            className="w-full pl-9 pr-3 py-2 border border-irc-gray-200 rounded-md text-sm focus:ring-2 focus:ring-irc-yellow focus:border-transparent"
          />
        </div>
        <select
          value={sectorFilter}
          onChange={e => setSectorFilter(e.target.value)}
          className="px-3 py-2 border border-irc-gray-200 rounded-md text-sm bg-white"
        >
          <option value="all">All Sectors</option>
          {sectors.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={linkFilter}
          onChange={e => setLinkFilter(e.target.value as 'all' | 'linked' | 'unlinked')}
          className="px-3 py-2 border border-irc-gray-200 rounded-md text-sm bg-white"
        >
          <option value="all">All Resources</option>
          <option value="linked">With Links Only</option>
          <option value="unlinked">Missing Links</option>
        </select>
      </div>

      {/* Results count */}
      <p className="text-xs text-irc-gray-400 mb-3">
        Showing {filtered.length} of {totalCount} resources
        {search && ` matching "${search}"`}
        {sectorFilter !== 'all' && ` in ${sectorFilter}`}
      </p>

      {/* Resource List */}
      <div className="space-y-2">
        {filtered.map((r, idx) => (
          <div key={`${r.name}-${idx}`} className="card p-3 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-3">
              <span className="shrink-0 mt-0.5">{getFileIcon(r.fileType)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-black hover:text-blue-700 hover:underline leading-snug"
                      >
                        {r.name} <span className="text-irc-gray-400">↗</span>
                      </a>
                    ) : (
                      <p className="text-sm font-medium text-irc-gray-500 leading-snug">{r.name}</p>
                    )}
                    <p className="text-xs text-irc-gray-400 mt-0.5">{r.context}</p>
                  </div>
                  <span className={`badge shrink-0 ${getSectorColor(r.sector)}`}>
                    {r.sector}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-irc-gray-500 py-8">No resources match your filters.</p>
      )}
    </div>
  );
}
