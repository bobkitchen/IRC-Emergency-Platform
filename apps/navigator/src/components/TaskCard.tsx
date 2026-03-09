import { useState } from 'react';
import type { Task } from '@/types';
import { getPhaseColorLight, getPriorityColor } from '@/lib/data';
import { Star, ExternalLink, Paperclip } from 'lucide-react';

interface Props {
  task: Task;
  showSector?: boolean;
  sectorName?: string;
}

export default function TaskCard({ task, showSector, sectorName }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="card p-3 sm:p-4 hover:shadow-md transition-shadow">
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

        {/* Subtask count */}
        {task.subtasks.length > 0 && (
          <span className="text-xs text-irc-gray-500 bg-irc-gray-100 px-2 py-0.5 rounded-full shrink-0">
            {task.subtasks.length}
          </span>
        )}
      </div>

      {/* Expanded subtasks */}
      {expanded && task.subtasks.length > 0 && (
        <div className="mt-3 ml-7 space-y-2 border-l-2 border-irc-yellow pl-3">
          {task.subtasks.map(sub => (
            <div key={sub.id} className="text-sm">
              <p className="text-irc-gray-700 leading-snug">{sub.title}</p>
              {sub.resources.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {sub.resources.map((res, idx) =>
                    res.url && (res.url.startsWith('http') || res.url.startsWith('mailto')) ? (
                      <a key={idx} href={res.url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-irc-gray-700 hover:text-black underline decoration-irc-gray-300 hover:decoration-black">
                        <ExternalLink className="w-3 h-3" /> {res.name}
                      </a>
                    ) : (
                      <span key={idx} className="inline-flex items-center gap-1 text-xs text-irc-gray-500">
                        <Paperclip className="w-3 h-3" /> {res.name}
                      </span>
                    )
                  )}
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
            {task.resources.map((res, idx) =>
              res.url && (res.url.startsWith('http') || res.url.startsWith('mailto')) ? (
                <a
                  key={idx}
                  href={res.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 text-irc-gray-700 text-xs rounded-md hover:bg-yellow-100 underline decoration-irc-gray-300 hover:decoration-black"
                >
                  🔗 {res.name}
                </a>
              ) : (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-irc-gray-50 text-irc-gray-500 text-xs rounded-md"
                >
                  📎 {res.name}
                </span>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
