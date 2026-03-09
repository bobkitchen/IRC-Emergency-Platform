import type { Filters } from '@/types';
import { processData } from '@/lib/data';

interface Props {
  filters: Filters;
  onChange: (filters: Filters) => void;
  taskCount: number;
  totalCount: number;
}

export default function FilterBar({ filters, onChange, taskCount, totalCount }: Props) {
  const update = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  return (
    <div className="bg-white border border-irc-gray-200 rounded-lg p-3 sm:p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-irc-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={filters.search}
            onChange={e => update({ search: e.target.value })}
            placeholder="Search tasks..."
            className="w-full pl-9 pr-3 py-2 border border-irc-gray-200 rounded-md text-sm focus:ring-2 focus:ring-irc-yellow focus:border-transparent"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap gap-2">
          {/* Classification */}
          <select
            value={filters.classification}
            onChange={e => update({ classification: e.target.value as Filters['classification'] })}
            className="px-3 py-2 border border-irc-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-irc-yellow"
          >
            <option value="all">All Classifications</option>
            <option value="red">Red</option>
            <option value="orange">Orange</option>
            <option value="yellow">Yellow</option>
          </select>

          {/* Office Type */}
          <select
            value={filters.officeType}
            onChange={e => update({ officeType: e.target.value as Filters['officeType'] })}
            className="px-3 py-2 border border-irc-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-irc-yellow"
          >
            <option value="all">All Office Types</option>
            <option value="new">New Office</option>
            <option value="existing">Existing Office</option>
          </select>

          {/* Phase */}
          <select
            value={filters.phase}
            onChange={e => update({ phase: e.target.value })}
            className="px-3 py-2 border border-irc-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-irc-yellow"
          >
            <option value="all">All Phases</option>
            {processData.phases.map(p => (
              <option key={p.id} value={p.id}>{p.id}: {p.name}</option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={filters.priority}
            onChange={e => update({ priority: e.target.value as Filters['priority'] })}
            className="px-3 py-2 border border-irc-gray-200 rounded-md text-sm bg-white focus:ring-2 focus:ring-irc-yellow"
          >
            <option value="all">All Priorities</option>
            <option value="key">Key Milestones</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-irc-gray-500">
          Showing {taskCount} of {totalCount} tasks
          {filters.search || filters.classification !== 'all' || filters.officeType !== 'all' || filters.phase !== 'all' || filters.priority !== 'all'
            ? ' (filtered)'
            : ''
          }
        </p>
        {(filters.search || filters.classification !== 'all' || filters.officeType !== 'all' || filters.phase !== 'all' || filters.priority !== 'all') && (
          <button
            onClick={() => onChange({ classification: 'all', officeType: 'all', phase: 'all', priority: 'all', search: '' })}
            className="text-xs text-irc-gray-700 hover:text-black font-medium"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
