export interface Phase {
  id: string;
  name: string;
  description: string;
  timeline: string;
}

export interface Contact {
  name: string;
  title: string;
  email: string;
}

export interface Resource {
  name: string;
  url: string;
  type: string;
}

export interface Subtask {
  id: string;
  title: string;
  resources: Resource[];
}

export type Classification = 'red' | 'orange' | 'yellow';
export type OfficeType = 'new' | 'existing' | 'both';
export type Priority = 'key' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  phase: string;
  classification: Classification[];
  officeType: OfficeType;
  priority: Priority;
  keyMilestone: boolean;
  timeline: string;
  responsible: string;
  subtasks: Subtask[];
  resources: Resource[];
  section?: string;
  dependencies?: string[];
}

export interface Sector {
  id: string;
  name: string;
  contacts: Contact[];
  tasks: Task[];
}

export interface Annex {
  id: string;
  name: string;
  filename: string;
  type: string;
  fileType: string;
  sectors: string[];
  phases: string[];
  description: string;
}

export interface GuidelineSection {
  title: string;
  content: string;
}

export interface EmUService {
  name: string;
  description: string;
  link: string;
  contact: string;
}

export interface PreparednessItem {
  category: string;
  name: string;
  link: string;
}

export interface ProcessData {
  phases: Phase[];
  sectors: Sector[];
  guidelines: GuidelineSection[];
  annexes: Annex[];
  emuServices: EmUService[];
  preparednessLibrary: PreparednessItem[];
  metadata: {
    buildDate: string;
    totalSectors: number;
    totalTasks: number;
    totalSubtasks: number;
    totalResources: number;
    totalResourcesWithUrls: number;
    totalAnnexes: number;
    totalEmuServices: number;
    totalPreparedness: number;
    totalDownloadedDocs: number;
    totalSearchChunks: number;
  };
}

export interface SearchChunk {
  id: string;
  type: 'task' | 'guideline' | 'resource';
  sector: string;
  sectorId: string;
  phase: string;
  title: string;
  content: string;
  classification: Classification[];
  officeType: OfficeType;
  priority: Priority;
}

export interface Filters {
  classification: Classification | 'all';
  officeType: OfficeType | 'all';
  phase: string | 'all';
  priority: Priority | 'all';
  search: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}
