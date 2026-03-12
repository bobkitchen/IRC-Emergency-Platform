import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Task } from '@/types';
import { getPhaseColorLight, getPriorityColor } from '@/lib/data';
import { Star, ExternalLink, ArrowRight, MessageCircle } from 'lucide-react';

// Cross-reference patterns → internal navigator links
const CROSS_REF_MAP: Array<{ pattern: RegExp; label: string; to: string }> = [
  { pattern: /see\s+meal\s+tab/i, label: 'MEAL sector', to: '/navigator/meal' },
  { pattern: /see\s+partnership[s]?\s+tab/i, label: 'Partnerships sector', to: '/navigator/partnerships' },
  { pattern: /see\s+preparedness\s+library/i, label: 'Preparedness Library', to: '/resources' },
  { pattern: /see\s+response\s+management/i, label: 'Response Management', to: '/navigator/rmie' },
  { pattern: /see\s+finance/i, label: 'Finance sector', to: '/navigator/finance' },
  { pattern: /see\s+supply\s+chain/i, label: 'Supply Chain sector', to: '/navigator/supply_chain' },
  { pattern: /see\s+safety/i, label: 'Safety & Security sector', to: '/navigator/safety_security' },
  { pattern: /see\s+safeguarding/i, label: 'Safeguarding sector', to: '/navigator/safeguarding' },
  { pattern: /see\s+grants/i, label: 'Grants sector', to: '/navigator/grants' },
  { pattern: /see\s+integra/i, label: 'Integra Launch', to: '/navigator/integra' },
  { pattern: /see\s+people|see\s+p&c|see\s+hr/i, label: 'People & Culture sector', to: '/navigator/people_culture' },
  { pattern: /see\s+technical/i, label: 'Technical Programs sector', to: '/navigator/technical_programs' },
];

// Items that are clearly not document resources — filter these out
function isNonResource(name: string): boolean {
  const n = name.trim();
  if (n.length < 3) return true;
  if (/^(n\/?a|link\??|resources?\??|red|tbd)$/i.test(n)) return true;
  // Long instructional text (> 80 chars) with sentence-like structure
  if (n.length > 80 && /[.,:;]/.test(n)) return true;
  // Contact/people references
  if (/^(MEAL Team|Finance & Supply Chain focal|TAs or QiE|RTC team)/i.test(n)) return true;
  return false;
}

// Check if a resource name is a cross-reference to another section
function getCrossRef(name: string): { label: string; to: string } | null {
  for (const ref of CROSS_REF_MAP) {
    if (ref.pattern.test(name)) return { label: ref.label, to: ref.to };
  }
  return null;
}

interface Props {
  task: Task;
  showSector?: boolean;
  sectorName?: string;
  onAskAlbert?: (query: string) => void;
}

export default function TaskCard({ task, showSector, sectorName, onAskAlbert }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div id={`task-${task.id}`} className="card p-3 sm:p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div
        className="flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Expand toggle */}
        {task.subtasks.length > 0 && (
          <button className="mt-0.5 shrink-0 text-irc-gray-400">
            <svg
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        <div className="flex-1 min-w-0">
          {/* Task ID + Title */}
          <div className="flex items-start gap-2">
            <span className="text-xs font-mono text-irc-gray-400 shrink-0 mt-0.5">{task.id}</span>
            <h4 className="text-sm font-medium text-black leading-snug">{task.title}</h4>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {/* Phase badge */}
            <span className={`badge ${getPhaseColorLight(task.phase)} border`}>
              {task.phase}
            </span>

            {/* Priority */}
            {(task.priority === 'key' || task.priority === 'high') && (
              <span className={`badge ${getPriorityColor(task.priority)}`}>
                {task.keyMilestone ? <><Star className="w-3 h-3 fill-current" /> Key Milestone</> : task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
              </span>
            )}

            {/* Classification badges */}
            {task.classification.length < 3 && task.classification.map(c => (
              <span key={c} className={`badge badge-${c}`}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </span>
            ))}

            {/* Office type */}
            {task.officeType !== 'both' && (
              <span className={`badge ${task.officeType === 'new' ? 'badge-new' : 'badge-existing'}`}>
                {task.officeType === 'new' ? 'New Office' : 'Existing'}
              </span>
            )}

            {/* Timeline */}
            {task.timeline && (
              <span className="badge bg-irc-gray-100 text-irc-gray-500">
                {task.timeline}
              </span>
            )}

            {showSector && sectorName && (
              <span className="badge bg-irc-gray-100 text-irc-gray-700">
                {sectorName}
              </span>
            )}
          </div>

          {/* Responsible */}
          {task.responsible && (
            <p className="text-xs text-irc-gray-500 mt-1.5">
              Owner: {task.responsible}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Ask Albert about this task */}
          {onAskAlbert && (
            <button
              onClick={e => { e.stopPropagation(); onAskAlbert(`Tell me about task ${task.id}: "${task.title}" in the ${task.phase} phase`); }}
              className="p-1 rounded hover:bg-yellow-50 text-irc-gray-400 hover:text-irc-yellow transition-colors"
              title="Ask Albert about this task"
              aria-label="Ask Albert about this task"
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {/* Resource count badge (when collapsed) */}
          {!expanded && task.resources.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-irc-gray-400 bg-irc-gray-50 px-2 py-0.5 rounded-full">
              <ExternalLink className="w-3 h-3" />
              {task.resources.length}
            </span>
          )}
          {/* Subtask count */}
          {task.subtasks.length > 0 && (
            <span className="text-xs text-irc-gray-500 bg-irc-gray-100 px-2 py-0.5 rounded-full">
              {task.subtasks.length}
            </span>
          )}
        </div>
      </div>

      {/* Expanded subtasks */}
      {expanded && task.subtasks.length > 0 && (
        <div className="mt-3 ml-7 space-y-2 border-l-2 border-irc-yellow pl-3">
          {task.subtasks.map(sub => (
            <div key={sub.id} className="text-sm">
              <p className="text-irc-gray-700 leading-snug">{sub.title}</p>
              {sub.resources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {sub.resources.map((res, idx) => {
                    // Skip non-resource items (instructions, contacts, placeholders)
                    if (isNonResource(res.name)) return null;

                    // External link
                    if (res.url && (res.url.startsWith('http') || res.url.startsWith('mailto'))) {
                      return (
                        <a key={idx} href={res.url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-50 text-xs text-irc-gray-700 hover:text-black hover:bg-yellow-100 rounded-md cursor-pointer underline decoration-irc-gray-300 hover:decoration-black transition-colors">
                          <ExternalLink className="w-3 h-3 shrink-0" /> {res.name}
                        </a>
                      );
                    }

                    // Cross-reference to another section
                    const crossRef = getCrossRef(res.name);
                    if (crossRef) {
                      return (
                        <Link key={idx} to={crossRef.to}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-irc-gray-50 text-xs text-irc-gray-700 hover:text-black hover:bg-irc-gray-100 rounded-md transition-colors">
                          <ArrowRight className="w-3 h-3 shrink-0" /> {crossRef.label}
                        </Link>
                      );
                    }

                    // Genuine document name without URL — skip it, don't confuse users
                    return null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Task resources */}
      {expanded && task.resources.length > 0 && (
        <div className="mt-3 ml-7">
          <p className="text-xs font-medium text-irc-gray-500 mb-1">Resources</p>
          <div className="flex flex-wrap gap-1.5">
            {task.resources.map((res, idx) => {
              if (isNonResource(res.name)) return null;

              if (res.url && (res.url.startsWith('http') || res.url.startsWith('mailto'))) {
                return (
                  <a
                    key={idx}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-irc-gray-700 text-xs rounded-md hover:bg-yellow-100 cursor-pointer underline decoration-irc-gray-300 hover:decoration-black transition-colors"
                  >
                    <ExternalLink className="w-3 h-3 shrink-0" /> {res.name}
                  </a>
                );
              }

              const crossRef = getCrossRef(res.name);
              if (crossRef) {
                return (
                  <Link key={idx} to={crossRef.to}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-irc-gray-50 text-xs text-irc-gray-700 hover:text-black hover:bg-irc-gray-100 rounded-md transition-colors">
                    <ArrowRight className="w-3 h-3 shrink-0" /> {crossRef.label}
                  </Link>
                );
              }

              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
}
