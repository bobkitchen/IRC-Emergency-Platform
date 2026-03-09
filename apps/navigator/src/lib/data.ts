import processDataJson from '@/data/process-data.json';
import searchChunksJson from '@/data/search-chunks.json';
import type { ProcessData, SearchChunk, Task, Sector, Filters } from '@/types';

export const processData = processDataJson as ProcessData;
export const searchChunks = searchChunksJson as SearchChunk[];

export function getAllTasks(): Task[] {
  return processData.sectors.flatMap(s => s.tasks);
}

export function getTasksBySector(sectorId: string): Task[] {
  const sector = processData.sectors.find(s => s.id === sectorId);
  return sector?.tasks ?? [];
}

export function getTasksByPhase(phaseId: string): Task[] {
  return getAllTasks().filter(t => t.phase === phaseId);
}

export function getSector(sectorId: string): Sector | undefined {
  return processData.sectors.find(s => s.id === sectorId);
}

export function filterTasks(tasks: Task[], filters: Filters): Task[] {
  return tasks.filter(task => {
    if (filters.classification !== 'all' && !task.classification.includes(filters.classification)) {
      return false;
    }
    if (filters.officeType !== 'all' && task.officeType !== 'both' && task.officeType !== filters.officeType) {
      return false;
    }
    if (filters.phase !== 'all' && task.phase !== filters.phase) {
      return false;
    }
    if (filters.priority !== 'all' && task.priority !== filters.priority) {
      return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const searchText = `${task.id} ${task.title} ${task.responsible} ${task.subtasks.map(s => s.title).join(' ')}`.toLowerCase();
      if (!searchText.includes(q)) {
        return false;
      }
    }
    return true;
  });
}

export function getPhaseColor(phaseId: string): string {
  const colors: Record<string, string> = {
    R1: 'bg-irc-crisis-red',
    R2: 'bg-irc-yellow',
    R3: 'bg-irc-yellow-light',
    R4: 'bg-irc-gray-700',
    R5: 'bg-irc-gray-500',
    R6: 'bg-irc-gray-400',
    R7: 'bg-irc-gray-200',
  };
  return colors[phaseId] || 'bg-irc-gray-200';
}

export function getPhaseColorLight(phaseId: string): string {
  const colors: Record<string, string> = {
    R1: 'bg-red-50 border-red-200 text-irc-crisis-red',
    R2: 'bg-yellow-50 border-irc-yellow text-yellow-800',
    R3: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    R4: 'bg-irc-gray-50 border-irc-gray-200 text-irc-gray-700',
    R5: 'bg-irc-gray-50 border-irc-gray-200 text-irc-gray-700',
    R6: 'bg-irc-gray-50 border-irc-gray-200 text-irc-gray-500',
    R7: 'bg-irc-gray-50 border-irc-gray-200 text-irc-gray-500',
  };
  return colors[phaseId] || 'bg-irc-gray-50 border-irc-gray-200 text-irc-gray-500';
}

export function getPriorityColor(priority: string): string {
  const colors: Record<string, string> = {
    key: 'bg-yellow-100 text-yellow-800',
    high: 'bg-yellow-50 text-yellow-800',
    medium: 'bg-irc-gray-100 text-irc-gray-700',
    low: 'bg-irc-gray-50 text-irc-gray-500',
  };
  return colors[priority] || 'bg-irc-gray-50 text-irc-gray-500';
}

export function getSectorIcon(sectorId: string): string {
  const icons: Record<string, string> = {
    rmie: '🎯',
    finance: '💰',
    people_culture: '👥',
    supply_chain: '📦',
    safety_security: '🛡️',
    safeguarding: '🤝',
    technical_programs: '⚙️',
    meal: '📊',
    grants: '📋',
    partnerships: '🤲',
    integra: '🔗',
    response_mgmt: '📡',
  };
  return icons[sectorId] || '📌';
}
