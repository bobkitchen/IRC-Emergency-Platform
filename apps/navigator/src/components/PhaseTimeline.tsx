import { processData, getPhaseColor } from '@/lib/data';
import type { Task } from '@/types';

interface Props {
  tasks: Task[];
  activePhase: string | 'all';
  onPhaseClick: (phase: string | 'all') => void;
}

export default function PhaseTimeline({ tasks, activePhase, onPhaseClick }: Props) {
  const phaseCounts = new Map<string, number>();
  for (const task of tasks) {
    phaseCounts.set(task.phase, (phaseCounts.get(task.phase) || 0) + 1);
  }

  return (
    <div className="bg-white rounded-lg border border-irc-gray-200 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-black tracking-irc-tight">Response Phases</h3>
        {activePhase !== 'all' && (
          <button
            onClick={() => onPhaseClick('all')}
            className="text-xs text-irc-gray-700 hover:text-black font-medium"
          >
            Show all
          </button>
        )}
      </div>

      {/* Desktop: horizontal timeline */}
      <div className="hidden md:block">
        <div className="flex items-center gap-1">
          {processData.phases.map((phase, idx) => {
            const count = phaseCounts.get(phase.id) || 0;
            const isActive = activePhase === phase.id;

            return (
              <div key={phase.id} className="flex items-center flex-1">
                <button
                  onClick={() => onPhaseClick(isActive ? 'all' : phase.id)}
                  className={`flex-1 rounded-lg p-2 text-center transition-all ${
                    isActive
                      ? 'ring-2 ring-irc-yellow shadow-md scale-[1.02] bg-yellow-50'
                      : 'hover:shadow-sm hover:scale-[1.01]'
                  }`}
                >
                  <div className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-white text-xs font-bold ${getPhaseColor(phase.id)}`}>
                    {phase.id.replace('R', '')}
                  </div>
                  <p className="text-xs font-medium text-irc-gray-700 mt-1 leading-tight">{phase.name}</p>
                  <p className="text-[10px] text-irc-gray-400 mt-0.5">{phase.timeline}</p>
                  {count > 0 && (
                    <span className="inline-block mt-1 text-[10px] bg-irc-gray-100 text-irc-gray-500 px-1.5 rounded-full">
                      {count}
                    </span>
                  )}
                </button>
                {idx < processData.phases.length - 1 && (
                  <div className="w-4 h-0.5 bg-irc-gray-200 shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical compact */}
      <div className="md:hidden space-y-1">
        {processData.phases.map(phase => {
          const count = phaseCounts.get(phase.id) || 0;
          const isActive = activePhase === phase.id;

          return (
            <button
              key={phase.id}
              onClick={() => onPhaseClick(isActive ? 'all' : phase.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${
                isActive ? 'bg-yellow-50 ring-1 ring-irc-yellow' : 'hover:bg-irc-gray-50'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${getPhaseColor(phase.id)}`}>
                {phase.id.replace('R', '')}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-irc-gray-700">{phase.name}</p>
                <p className="text-xs text-irc-gray-400">{phase.timeline}</p>
              </div>
              <span className="text-xs text-irc-gray-400">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
