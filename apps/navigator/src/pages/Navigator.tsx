import { useState, useMemo, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { processData, filterTasks } from '@/lib/data';
import SectorIcon from '@/components/SectorIcon';
import type { Filters, Classification, OfficeType, Priority } from '@/types';
import PhaseTimeline from '@/components/PhaseTimeline';
import FilterBar from '@/components/FilterBar';
import TaskCard from '@/components/TaskCard';
import { useClassification } from '@/context/ClassificationContext';
import { X } from 'lucide-react';

export default function Navigator() {
  const { sectorId } = useParams<{ sectorId?: string }>();
  const [searchParams] = useSearchParams();
  const { country, stance, clearClassification } = useClassification();

  // Determine initial classification: URL param takes precedence, then context stance
  const urlClassification = searchParams.get('classification') as Classification | null;
  const initialClassification = urlClassification || (stance as Classification) || 'all';

  const [filters, setFilters] = useState<Filters>({
    classification: initialClassification,
    officeType: 'all' as OfficeType | 'all',
    phase: searchParams.get('phase') || 'all',
    priority: 'all' as Priority | 'all',
    search: '',
  });

  // Update filters when URL params change
  useEffect(() => {
    const cls = searchParams.get('classification') as Classification | null;
    const phase = searchParams.get('phase');
    if (cls || phase) {
      setFilters(prev => ({
        ...prev,
        classification: cls || prev.classification,
        phase: phase || prev.phase,
      }));
    }
  }, [searchParams]);

  // Sync context stance to filters when no URL override
  useEffect(() => {
    if (!urlClassification && stance) {
      setFilters(prev => ({
        ...prev,
        classification: stance as Classification,
      }));
    }
  }, [stance, urlClassification]);

  const activeSector = sectorId
    ? processData.sectors.find(s => s.id === sectorId)
    : null;

  const allTasks = useMemo(() => {
    if (activeSector) return activeSector.tasks;
    return processData.sectors.flatMap(s => s.tasks);
  }, [activeSector]);

  const filteredTasks = useMemo(() => filterTasks(allTasks, filters), [allTasks, filters]);

  // Group tasks by phase
  const tasksByPhase = useMemo(() => {
    const grouped = new Map<string, typeof filteredTasks>();
    for (const task of filteredTasks) {
      const existing = grouped.get(task.phase) || [];
      existing.push(task);
      grouped.set(task.phase, existing);
    }
    return grouped;
  }, [filteredTasks]);

  const handlePhaseClick = (phase: string | 'all') => {
    setFilters(prev => ({ ...prev, phase: phase === prev.phase ? 'all' : phase }));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb + Title */}
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-irc-gray-500 mb-1">
          <Link to="/" className="hover:text-black">Home</Link>
          <span>/</span>
          <Link to="/navigator" className={`hover:text-black ${!sectorId ? 'text-black font-medium' : ''}`}>
            Navigator
          </Link>
          {activeSector && (
            <>
              <span>/</span>
              <span className="text-black font-medium">{activeSector.name}</span>
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold text-black tracking-irc-tight">
            {activeSector ? (
              <span className="flex items-center gap-2">
                <SectorIcon sectorId={activeSector.id} className="w-5 h-5" />
                {activeSector.name}
              </span>
            ) : (
              'Process Navigator'
            )}
          </h1>
        </div>
        {activeSector && activeSector.contacts.length > 0 && (
          <div className="mt-1 text-xs text-irc-gray-500">
            Contact: {activeSector.contacts.map(c => `${c.name} (${c.email})`).join(', ')}
          </div>
        )}
      </div>

      {/* Sector Tabs (when viewing all) */}
      {!sectorId && (
        <div className="mb-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max pb-2">
            <Link
              to="/navigator"
              className="px-3 py-1.5 rounded-full text-xs font-medium bg-black text-white"
            >
              All Sectors
            </Link>
            {processData.sectors.map(sector => (
              <Link
                key={sector.id}
                to={`/navigator/${sector.id}`}
                className="px-3 py-1.5 rounded-full text-xs font-medium border border-irc-gray-200 text-irc-gray-500 hover:border-irc-yellow hover:bg-yellow-50 transition-colors whitespace-nowrap"
              >
                <SectorIcon sectorId={sector.id} className="w-3.5 h-3.5 inline-block" /> {sector.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sector Tabs (when viewing specific sector) */}
      {sectorId && (
        <div className="mb-4 overflow-x-auto">
          <div className="flex gap-1 min-w-max pb-2">
            <Link
              to="/navigator"
              className="px-3 py-1.5 rounded-full text-xs font-medium border border-irc-gray-200 text-irc-gray-500 hover:border-irc-yellow hover:bg-yellow-50 transition-colors"
            >
              All Sectors
            </Link>
            {processData.sectors.map(sector => (
              <Link
                key={sector.id}
                to={`/navigator/${sector.id}`}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  sector.id === sectorId
                    ? 'bg-black text-white'
                    : 'border border-irc-gray-200 text-irc-gray-500 hover:border-irc-yellow hover:bg-yellow-50'
                }`}
              >
                <SectorIcon sectorId={sector.id} className="w-3.5 h-3.5 inline-block" /> {sector.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Phase Timeline */}
      <div className="mb-4">
        <PhaseTimeline
          tasks={allTasks}
          activePhase={filters.phase}
          onPhaseClick={handlePhaseClick}
        />
      </div>

      {/* Context Banner */}
      {country && stance && (
        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-irc-gray-50 border border-irc-gray-200 text-sm">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
            stance === 'red' ? 'bg-irc-crisis-red' : stance === 'orange' ? 'bg-orange-400' : 'bg-irc-yellow'
          }`} />
          <span className="text-irc-gray-700">
            Filtering for <strong>{country}</strong> — {stance.charAt(0).toUpperCase() + stance.slice(1)} classification
          </span>
          <button
            onClick={clearClassification}
            className="ml-auto text-irc-gray-400 hover:text-black transition-colors"
            aria-label="Clear country filter"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="mb-4">
        <FilterBar
          filters={filters}
          onChange={setFilters}
          taskCount={filteredTasks.length}
          totalCount={allTasks.length}
        />
      </div>

      {/* Task List */}
      <div className="space-y-6">
        {filters.phase === 'all' ? (
          // Show grouped by phase
          processData.phases.map(phase => {
            const phaseTasks = tasksByPhase.get(phase.id);
            if (!phaseTasks || phaseTasks.length === 0) return null;
            return (
              <div key={phase.id}>
                <h2 className="text-xs font-bold text-irc-gray-700 mb-2 flex items-center gap-2 tracking-irc-tight uppercase">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    phase.id === 'R1' ? 'bg-irc-crisis-red' :
                    phase.id === 'R2' ? 'bg-irc-yellow' :
                    phase.id === 'R3' ? 'bg-irc-yellow-light' :
                    phase.id === 'R4' ? 'bg-irc-gray-700' :
                    phase.id === 'R5' ? 'bg-irc-gray-500' :
                    phase.id === 'R6' ? 'bg-irc-gray-400' :
                    'bg-irc-gray-200'
                  }`}>
                    {phase.id.replace('R', '')}
                  </span>
                  {phase.id}: {phase.name}
                  <span className="text-irc-gray-400 font-normal">({phaseTasks.length})</span>
                </h2>
                <div className="space-y-2">
                  {phaseTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      showSector={!sectorId}
                      sectorName={processData.sectors.find(s => s.tasks.includes(task))?.name}
                    />
                  ))}
                </div>
              </div>
            );
          })
        ) : (
          // Show flat list for single phase
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                showSector={!sectorId}
                sectorName={processData.sectors.find(s => s.tasks.includes(task))?.name}
              />
            ))}
          </div>
        )}

        {filteredTasks.length === 0 && (
          <div className="text-center py-12">
            <p className="text-irc-gray-500">No tasks match the current filters.</p>
            <button
              onClick={() => setFilters({ classification: 'all', officeType: 'all', phase: 'all', priority: 'all', search: '' })}
              className="mt-2 text-sm text-irc-gray-700 hover:text-black font-medium"
            >
              Clear all filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
