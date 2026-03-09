/**
 * Build-time data pipeline: Parse all source docs into structured process-data.json
 * Reads CSV sector files, guidelines markdown, EmU services, and annex metadata
 */
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');
const CSV_DIR = path.join(ROOT, 'csv');
const APP_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(APP_DIR, 'src', 'data');

// ──────────────────────────────────────────────
// PHASE DEFINITIONS
// ──────────────────────────────────────────────
const PHASES = [
  { id: 'R1', name: 'Emergency Onset', description: 'Crisis monitoring, classification, Go/No-Go decision, initial deployments', timeline: 'Week 0-1' },
  { id: 'R2', name: 'Context Analysis', description: 'Multi-sector needs assessment, situation analysis, feasibility assessment', timeline: 'Week 1-2' },
  { id: 'R3', name: 'Strategy Development', description: 'Response strategy, program design, partnership and funding strategy', timeline: 'Week 2-3' },
  { id: 'R4', name: 'Response Planning', description: 'Response plan, budget development, logframe, staffing plan, procurement', timeline: 'Week 3-4' },
  { id: 'R5', name: 'Implementation', description: 'Program delivery, operations setup, procurement, monitoring', timeline: 'Month 1-3' },
  { id: 'R6', name: 'Learnings', description: 'After-action review, real-time evaluations, case studies', timeline: 'Month 3+' },
  { id: 'R7', name: 'Transition & Handover', description: 'Transition planning, handover to long-term programming, documentation', timeline: 'Month 3-6+' },
];

// ──────────────────────────────────────────────
// SECTOR DEFINITIONS
// ──────────────────────────────────────────────
const SECTOR_MAP = {
  'RMiE': { id: 'rmie', name: 'Response Management', csvFile: 'RMiE.csv', format: 'rmie' },
  'Response_Management': { id: 'response_mgmt', name: 'Response Management (Overview)', csvFile: 'Response_Management.csv', format: 'response_mgmt' },
  'Finance': { id: 'finance', name: 'Finance', csvFile: 'Finance.csv', format: 'standard' },
  'People___Culture': { id: 'people_culture', name: 'People & Culture', csvFile: 'People___Culture.csv', format: 'standard' },
  'PCiE': { id: 'pcie', name: 'People & Culture in Emergencies', csvFile: 'PCiE.csv', format: 'pcie' },
  'Supply_Chain': { id: 'supply_chain', name: 'Supply Chain', csvFile: 'Supply_Chain.csv', format: 'standard' },
  'Safety___Security': { id: 'safety_security', name: 'Safety & Security', csvFile: 'Safety___Security.csv', format: 'standard' },
  'Safeguarding': { id: 'safeguarding', name: 'Safeguarding', csvFile: 'Safeguarding.csv', format: 'safeguarding' },
  'Technical_Programs': { id: 'technical_programs', name: 'Technical Programs', csvFile: 'Technical_Programs.csv', format: 'standard' },
  'MEAL': { id: 'meal', name: 'MEAL', csvFile: 'MEAL.csv', format: 'standard' },
  'Grants': { id: 'grants', name: 'Grants', csvFile: 'Grants.csv', format: 'standard' },
  'Partnerships': { id: 'partnerships', name: 'Partnerships', csvFile: 'Partnerships.csv', format: 'standard' },
  'Integra_Launch': { id: 'integra', name: 'Integra Launch', csvFile: 'Integra_Launch.csv', format: 'integra' },
};

// ──────────────────────────────────────────────
// CONTACT EXTRACTION
// ──────────────────────────────────────────────
function extractContacts(rows) {
  const contacts = [];
  for (const row of rows.slice(0, 8)) {
    const text = row.join(' ');
    const emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      const email = emailMatch[0];
      // Try to find the name near the email
      for (const cell of row) {
        if (cell && cell.includes(email)) {
          const nameMatch = cell.match(/^([^,]+),\s*(.+)/);
          if (nameMatch) {
            contacts.push({ name: nameMatch[1].trim(), title: nameMatch[2].trim(), email });
          }
        }
      }
      if (contacts.length === 0 || contacts[contacts.length - 1].email !== email) {
        // Try looking at the "Contact:" pattern
        const nameCol = row.find(c => c && !c.includes('@') && !c.includes('Contact') && !c.includes('support') && !c.includes('Tab') && c.trim().length > 2);
        if (nameCol) {
          contacts.push({ name: nameCol.trim(), title: '', email });
        }
      }
    }
  }
  return contacts;
}

// ──────────────────────────────────────────────
// PHASE DETECTION
// ──────────────────────────────────────────────
function detectPhase(text) {
  if (!text) return null;
  const t = text.trim();
  const match = t.match(/R(\d)/);
  if (match) return `R${match[1]}`;
  if (/preparedness|pre-?launch/i.test(t)) return 'R1';
  if (/emergency\s*onset|onset/i.test(t)) return 'R1';
  if (/context\s*analysis/i.test(t)) return 'R2';
  if (/strategy\s*dev/i.test(t)) return 'R3';
  if (/response\s*plan/i.test(t)) return 'R4';
  if (/implementation/i.test(t)) return 'R5';
  if (/learning/i.test(t)) return 'R6';
  if (/transition|handover/i.test(t)) return 'R7';
  return null;
}

// ──────────────────────────────────────────────
// CLASSIFICATION PARSING
// ──────────────────────────────────────────────
function parseClassification(text) {
  if (!text) return ['red', 'orange', 'yellow'];
  const t = text.toLowerCase();
  const cls = [];
  if (t.includes('red')) cls.push('red');
  if (t.includes('orange')) cls.push('orange');
  if (t.includes('yellow')) cls.push('yellow');
  return cls.length > 0 ? cls : ['red', 'orange', 'yellow'];
}

// ──────────────────────────────────────────────
// OFFICE TYPE PARSING
// ──────────────────────────────────────────────
function parseOfficeType(text) {
  if (!text) return 'both';
  const t = text.toLowerCase();
  if (t.includes('new') && t.includes('existing')) return 'both';
  if (t.includes('new')) return 'new';
  if (t.includes('existing')) return 'existing';
  return 'both';
}

// ──────────────────────────────────────────────
// PRIORITY PARSING
// ──────────────────────────────────────────────
function parsePriority(priorityText, milestoneText) {
  const p = (priorityText || '').toLowerCase();
  const m = (milestoneText || '').toLowerCase();
  if (m.includes('key') || p.includes('key')) return 'key';
  if (p.includes('high')) return 'high';
  if (p.includes('medium') || p.includes('med')) return 'medium';
  if (p.includes('low')) return 'low';
  return 'medium';
}

// ──────────────────────────────────────────────
// STANDARD FORMAT CSV PARSER
// Columns: Response Stage, New or Existing Office, Classification, Responsible, Priority, Key Milestone, Expected Timeline, Status, Tasks, Subtasks, Resources / Support, Box Link, ...
// ──────────────────────────────────────────────
function parseStandardCSV(csvContent, sectorId) {
  const rows = parse(csvContent, { relax_column_count: true, skip_empty_lines: false });
  const contacts = extractContacts(rows);

  // Find header row
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].join(' ').toLowerCase();
    if (row.includes('response stage') && (row.includes('task') || row.includes('subtask'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { contacts, tasks: [] };

  const tasks = [];
  let currentPhase = null;
  let currentTask = null;
  let taskCounter = 0;

  for (let i = headerIdx + 2; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c || !c.trim())) continue;

    const responseStage = (row[0] || '').trim();
    const officeType = (row[1] || '').trim();
    const classification = (row[2] || '').trim();
    const responsible = (row[3] || '').trim();
    const priority = (row[4] || '').trim();
    const keyMilestone = (row[5] || '').trim();
    const timeline = (row[6] || '').trim();
    const status = (row[7] || '').trim();
    const taskTitle = (row[8] || '').trim();
    const subtaskTitle = (row[9] || '').trim();
    const resource = (row[10] || '').trim();
    const boxLink = (row[11] || '').trim();

    // Phase header detection
    const detectedPhase = detectPhase(responseStage);
    if (detectedPhase) {
      currentPhase = detectedPhase;
      // If the row only has the phase and nothing else meaningful, skip
      if (!taskTitle && !subtaskTitle) continue;
    }

    // Skip example rows
    if (taskTitle === '[TASK 1]' || taskTitle === 'EXAMPLE' || subtaskTitle === '[SUBTASK 1.1]') continue;
    if (taskTitle.startsWith('[TASK') || subtaskTitle.startsWith('[SUBTASK')) continue;

    // If we have a task title, start a new task
    if (taskTitle && !taskTitle.startsWith('[')) {
      taskCounter++;
      currentTask = {
        id: `${sectorId.toUpperCase()}-${String(taskCounter).padStart(3, '0')}`,
        title: taskTitle,
        phase: currentPhase || 'R1',
        classification: parseClassification(classification),
        officeType: parseOfficeType(officeType),
        priority: parsePriority(priority, keyMilestone),
        keyMilestone: !!(keyMilestone && keyMilestone.toLowerCase().includes('key')),
        timeline: timeline || '',
        responsible: responsible,
        subtasks: [],
        resources: [],
      };

      // Add subtask if present on same row
      if (subtaskTitle && !subtaskTitle.startsWith('[')) {
        currentTask.subtasks.push({
          id: `${currentTask.id}.${currentTask.subtasks.length + 1}`,
          title: subtaskTitle,
          resources: [],
        });
      }

      // Add resource if present
      if (resource && !resource.startsWith('[')) {
        const res = { name: resource, url: boxLink || '', type: guessResourceType(resource) };
        if (currentTask.subtasks.length > 0) {
          currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(res);
        } else {
          currentTask.resources.push(res);
        }
      }

      tasks.push(currentTask);
    } else if (subtaskTitle && currentTask && !subtaskTitle.startsWith('[')) {
      // Subtask row
      currentTask.subtasks.push({
        id: `${currentTask.id}.${currentTask.subtasks.length + 1}`,
        title: subtaskTitle,
        resources: [],
      });
      if (resource && !resource.startsWith('[')) {
        const res = { name: resource, url: boxLink || '', type: guessResourceType(resource) };
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(res);
      }
    } else if (resource && currentTask && !resource.startsWith('[')) {
      // Resource-only row — attach to last subtask or task
      const res = { name: resource, url: boxLink || '', type: guessResourceType(resource) };
      if (currentTask.subtasks.length > 0) {
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(res);
      } else {
        currentTask.resources.push(res);
      }
    }
  }

  return { contacts, tasks };
}

// ──────────────────────────────────────────────
// RMiE FORMAT PARSER (different column order)
// Columns: blank, TASK ID, TASK TITLE, RESOURCE LINK, TASK OWNER, NEW OFFICE TASK ONLY, KEY MILESTONE, PRIORITY LEVEL, RESPONSE STAGE, TIMELINE, CURRENT PROGRESS, NOTES
// ──────────────────────────────────────────────
function parseRMiECSV(csvContent, sectorId) {
  const rows = parse(csvContent, { relax_column_count: true, skip_empty_lines: false });
  const contacts = extractContacts(rows);

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i].join(' ').toLowerCase();
    if (row.includes('task') && (row.includes('id') || row.includes('title'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { contacts, tasks: [] };

  const tasks = [];
  let currentTask = null;
  let currentSection = '';

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c || !c.trim())) continue;

    const taskId = (row[1] || '').trim();
    const taskTitle = (row[2] || '').trim();
    const resourceLink = (row[3] || '').trim();
    const taskOwner = (row[4] || '').trim();
    const newOffice = (row[5] || '').trim();
    const keyMilestone = (row[6] || '').trim();
    const priorityLevel = (row[7] || '').trim();
    const responseStage = (row[8] || '').trim();
    const timeline = (row[9] || '').trim();

    // Section headers (like "ADMINISTRATION & MANAGEMENT", "PROGRAMS", "FINANCE", "OPERATIONS")
    if (taskId && !taskId.includes('.') && taskTitle && taskTitle === taskTitle.toUpperCase() && !keyMilestone && !timeline) {
      currentSection = taskTitle;
      continue;
    }

    // Skip example rows
    if (taskTitle === '[TASK 1]' || taskTitle === 'EXAMPLE') continue;

    // Main task (integer ID like 2, 3, 4...)
    const isMainTask = taskId && /^\d+$/.test(taskId) && taskTitle;
    const isSubtask = taskId && /^\d+\.\d+/.test(taskId);

    if (isMainTask) {
      currentTask = {
        id: `${sectorId.toUpperCase()}-${String(taskId).padStart(3, '0')}`,
        title: taskTitle,
        phase: detectPhase(responseStage) || 'R1',
        classification: ['red', 'orange', 'yellow'],
        officeType: newOffice.toLowerCase().includes('new') ? 'new' : 'both',
        priority: parsePriority(priorityLevel, keyMilestone),
        keyMilestone: !!(keyMilestone && keyMilestone.toLowerCase().includes('key')),
        timeline: timeline || '',
        responsible: taskOwner,
        subtasks: [],
        resources: [],
        section: currentSection,
      };
      if (resourceLink && !resourceLink.startsWith('[')) {
        currentTask.resources.push({ name: resourceLink, url: '', type: guessResourceType(resourceLink) });
      }
      tasks.push(currentTask);
    } else if (isSubtask && currentTask) {
      const sub = {
        id: `${currentTask.id}.${currentTask.subtasks.length + 1}`,
        title: taskTitle,
        resources: [],
      };
      if (resourceLink && !resourceLink.startsWith('[')) {
        sub.resources.push({ name: resourceLink, url: '', type: guessResourceType(resourceLink) });
      }
      currentTask.subtasks.push(sub);
    }
  }

  return { contacts, tasks };
}

// ──────────────────────────────────────────────
// PCiE FORMAT PARSER (similar to RMiE but slightly different)
// ──────────────────────────────────────────────
function parsePCiECSV(csvContent, sectorId) {
  const rows = parse(csvContent, { relax_column_count: true, skip_empty_lines: false });
  const contacts = extractContacts(rows);

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i].join(' ').toLowerCase();
    if (row.includes('task') && (row.includes('id') || row.includes('title'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { contacts, tasks: [] };

  const tasks = [];
  let currentTask = null;
  let currentSection = '';

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c || !c.trim())) continue;

    const taskId = (row[1] || '').trim();
    const taskTitle = (row[2] || '').trim();
    const resourceLink = (row[3] || '').trim();
    const taskOwner = (row[4] || '').trim();
    const newOffice = (row[5] || '').trim();
    const keyMilestone = (row[6] || '').trim();
    const priorityLevel = (row[7] || '').trim();
    const timeline = (row[8] || '').trim();

    // Section headers
    if (taskId && !taskId.includes('.') && taskTitle && taskTitle === taskTitle.toUpperCase() && !keyMilestone && !timeline) {
      currentSection = taskTitle;
      continue;
    }

    if (taskTitle === '[TASK 1]') continue;

    const isMainTask = taskId && /^\d+$/.test(taskId) && taskTitle;
    const isSubtask = taskId && /^\d+\.\d+/.test(taskId);

    if (isMainTask) {
      currentTask = {
        id: `${sectorId.toUpperCase()}-${String(taskId).padStart(3, '0')}`,
        title: taskTitle,
        phase: 'R1',
        classification: ['red', 'orange', 'yellow'],
        officeType: newOffice.toLowerCase().includes('new') ? 'new' : 'both',
        priority: parsePriority(priorityLevel, keyMilestone),
        keyMilestone: !!(keyMilestone && keyMilestone.toLowerCase().includes('key')),
        timeline: timeline || '',
        responsible: taskOwner,
        subtasks: [],
        resources: [],
        section: currentSection,
      };
      if (resourceLink && !resourceLink.startsWith('[')) {
        currentTask.resources.push({ name: resourceLink, url: '', type: guessResourceType(resourceLink) });
      }
      tasks.push(currentTask);
    } else if (isSubtask && currentTask) {
      const sub = {
        id: `${currentTask.id}.${currentTask.subtasks.length + 1}`,
        title: taskTitle,
        resources: [],
      };
      if (resourceLink && !resourceLink.startsWith('[')) {
        sub.resources.push({ name: resourceLink, url: '', type: guessResourceType(resourceLink) });
      }
      currentTask.subtasks.push(sub);
    }
  }

  return { contacts, tasks };
}

// ──────────────────────────────────────────────
// Response Management Overview parser (different column structure)
// ──────────────────────────────────────────────
function parseResponseMgmtCSV(csvContent, sectorId) {
  const rows = parse(csvContent, { relax_column_count: true, skip_empty_lines: false });
  const contacts = extractContacts(rows);

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const row = rows[i].join(' ').toLowerCase();
    if (row.includes('response stage') && (row.includes('task') || row.includes('classification'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { contacts, tasks: [] };

  const tasks = [];
  let currentPhase = null;
  let currentTask = null;
  let taskCounter = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c || !c.trim())) continue;

    // Response Mgmt has format: [counter], Response Stage, New/Existing, Classification, Responsible, Key Milestone, Priority, Status, Tasks, Subtasks, Resources, Box Link
    const counter = (row[0] || '').trim();
    const responseStage = (row[1] || '').trim();
    const officeType = (row[2] || '').trim();
    const classification = (row[3] || '').trim();
    const responsible = (row[4] || '').trim();
    const keyMilestone = (row[5] || '').trim();
    const priority = (row[6] || '').trim();
    const status = (row[7] || '').trim();
    const taskTitle = (row[8] || '').trim();
    const subtaskTitle = (row[9] || '').trim();
    const resource = (row[10] || '').trim();
    const boxLink = (row[11] || '').trim();

    const detectedPhase = detectPhase(responseStage);
    if (detectedPhase) {
      currentPhase = detectedPhase;
      if (!taskTitle && !subtaskTitle) continue;
    }

    if (taskTitle === '[TASK 1]' || taskTitle === 'EXAMPLE') continue;
    if (taskTitle.startsWith('[') || subtaskTitle.startsWith('[SUBTASK')) continue;

    if (taskTitle) {
      taskCounter++;
      currentTask = {
        id: `${sectorId.toUpperCase()}-${String(taskCounter).padStart(3, '0')}`,
        title: taskTitle,
        phase: currentPhase || 'R1',
        classification: parseClassification(classification),
        officeType: parseOfficeType(officeType),
        priority: parsePriority(priority, keyMilestone),
        keyMilestone: !!(keyMilestone && keyMilestone.toLowerCase().includes('key')),
        timeline: '',
        responsible: responsible,
        subtasks: [],
        resources: [],
      };
      if (subtaskTitle) {
        currentTask.subtasks.push({ id: `${currentTask.id}.1`, title: subtaskTitle, resources: [] });
      }
      if (resource && !resource.startsWith('[')) {
        const res = { name: resource, url: boxLink || '', type: guessResourceType(resource) };
        currentTask.resources.push(res);
      }
      tasks.push(currentTask);
    } else if (subtaskTitle && currentTask) {
      currentTask.subtasks.push({
        id: `${currentTask.id}.${currentTask.subtasks.length + 1}`,
        title: subtaskTitle,
        resources: [],
      });
      if (resource && !resource.startsWith('[')) {
        const res = { name: resource, url: boxLink || '', type: guessResourceType(resource) };
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(res);
      }
    } else if (resource && currentTask && !resource.startsWith('[')) {
      const res = { name: resource, url: boxLink || '', type: guessResourceType(resource) };
      if (currentTask.subtasks.length > 0) {
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(res);
      } else {
        currentTask.resources.push(res);
      }
    }
  }

  return { contacts, tasks };
}

// ──────────────────────────────────────────────
// Safeguarding format (slightly different column order: Key Milestone and Priority swapped)
// ──────────────────────────────────────────────
function parseSafeguardingCSV(csvContent, sectorId) {
  // Reuse standard parser — columns are close enough
  return parseStandardCSV(csvContent, sectorId);
}

// ──────────────────────────────────────────────
// Integra Launch format
// ──────────────────────────────────────────────
function parseIntegraCSV(csvContent, sectorId) {
  const rows = parse(csvContent, { relax_column_count: true, skip_empty_lines: false });
  const contacts = extractContacts(rows);

  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const row = rows[i].join(' ').toLowerCase();
    if (row.includes('status') && row.includes('task')) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx === -1) return { contacts, tasks: [] };

  const tasks = [];
  let currentTask = null;
  let taskCounter = 0;
  let currentSection = '';

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(c => !c || !c.trim())) continue;

    const status = (row[1] || '').trim();
    const timetable = (row[2] || '').trim();
    const taskTitle = (row[3] || '').trim();
    const subtaskTitle = (row[4] || '').trim();
    const taskOwner = (row[5] || '').trim();
    const oversight = (row[6] || '').trim();
    const resource = (row[7] || '').trim();

    // Section headers
    if (taskTitle && !subtaskTitle && !taskOwner && !timetable) {
      currentSection = taskTitle;
      continue;
    }

    if (taskTitle && timetable) {
      taskCounter++;
      currentTask = {
        id: `${sectorId.toUpperCase()}-${String(taskCounter).padStart(3, '0')}`,
        title: taskTitle,
        phase: 'R4',
        classification: ['red', 'orange', 'yellow'],
        officeType: 'new',
        priority: 'high',
        keyMilestone: false,
        timeline: timetable,
        responsible: taskOwner,
        subtasks: [],
        resources: [],
        section: currentSection,
      };
      if (subtaskTitle) {
        currentTask.subtasks.push({ id: `${currentTask.id}.1`, title: subtaskTitle, resources: [] });
      }
      if (resource) {
        currentTask.resources.push({ name: resource, url: '', type: guessResourceType(resource) });
      }
      tasks.push(currentTask);
    } else if (subtaskTitle && currentTask) {
      currentTask.subtasks.push({
        id: `${currentTask.id}.${currentTask.subtasks.length + 1}`,
        title: subtaskTitle,
        resources: [],
      });
      if (resource) {
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push({ name: resource, url: '', type: guessResourceType(resource) });
      }
    }
  }

  return { contacts, tasks };
}

// ──────────────────────────────────────────────
// RESOURCE TYPE GUESSER
// ──────────────────────────────────────────────
function guessResourceType(name) {
  const n = name.toLowerCase();
  if (n.includes('template')) return 'template';
  if (n.includes('guidance') || n.includes('guide') || n.includes('handbook')) return 'guidance';
  if (n.includes('tor') || n.includes('terms of reference')) return 'tor';
  if (n.includes('example') || n.includes('sample')) return 'example';
  if (n.includes('checklist')) return 'checklist';
  if (n.includes('form') || n.includes('request')) return 'form';
  if (n.includes('policy') || n.includes('protocol') || n.includes('sop')) return 'policy';
  if (n.includes('training') || n.includes('e-learning')) return 'training';
  return 'tool';
}

// ──────────────────────────────────────────────
// ANNEX DOCUMENTS
// ──────────────────────────────────────────────
function buildAnnexList() {
  const annexDir = path.join(ROOT, 'additional-docs', 'Annexes');
  if (!fs.existsSync(annexDir)) return [];

  const files = fs.readdirSync(annexDir);
  return files.filter(f => !f.startsWith('.')).map((filename, idx) => {
    const ext = path.extname(filename).toLowerCase();
    const name = filename.replace(/^\d+_?/, '').replace(ext, '').replace(/_/g, ' ').trim();

    // Tag by content
    const fn = filename.toLowerCase();
    const sectors = [];
    const phases = [];

    if (fn.includes('scale') || fn.includes('classification')) { sectors.push('response_mgmt'); phases.push('R1'); }
    if (fn.includes('response plan')) { sectors.push('response_mgmt'); phases.push('R4'); }
    if (fn.includes('sitrep') || fn.includes('situation report')) { sectors.push('response_mgmt'); phases.push('R1', 'R5'); }
    if (fn.includes('transition') || fn.includes('handover')) { sectors.push('response_mgmt'); phases.push('R7'); }
    if (fn.includes('ermt') || fn.includes('management team')) { sectors.push('rmie'); phases.push('R1'); }
    if (fn.includes('deployment') || fn.includes('ert') || fn.includes('staff')) { sectors.push('people_culture'); phases.push('R1', 'R3'); }
    if (fn.includes('procurement') || fn.includes('erpp') || fn.includes('supply')) { sectors.push('supply_chain'); phases.push('R5'); }
    if (fn.includes('safeguard')) { sectors.push('safeguarding'); }
    if (fn.includes('partner')) { sectors.push('partnerships'); }
    if (fn.includes('crisis') || fn.includes('coordination')) { sectors.push('rmie'); phases.push('R1'); }
    if (fn.includes('preparedness')) { phases.push('R1'); }
    if (fn.includes('conops') || fn.includes('concept')) { sectors.push('response_mgmt'); phases.push('R1'); }
    if (fn.includes('mou')) { sectors.push('people_culture'); phases.push('R1'); }
    if (fn.includes('imperative')) { sectors.push('response_mgmt'); phases.push('R1'); }
    if (fn.includes('engagement model')) { sectors.push('rmie'); phases.push('R1'); }
    if (fn.includes('quality') || fn.includes('technical')) { sectors.push('technical_programs'); phases.push('R5'); }
    if (fn.includes('geso')) { sectors.push('technical_programs'); }
    if (fn.includes('change log') || fn.includes('emg')) { sectors.push('response_mgmt'); }
    if (fn.includes('menu') || fn.includes('program')) { sectors.push('technical_programs'); phases.push('R3'); }

    if (sectors.length === 0) sectors.push('response_mgmt');
    if (phases.length === 0) phases.push('R1', 'R3', 'R5');

    return {
      id: `ANNEX-${String(idx + 1).padStart(3, '0')}`,
      name: name || filename,
      filename,
      type: guessResourceType(filename),
      fileType: ext.replace('.', ''),
      sectors: [...new Set(sectors)],
      phases: [...new Set(phases)],
      description: `Annex document: ${name || filename}`,
    };
  });
}

// ──────────────────────────────────────────────
// EmU SERVICES
// ──────────────────────────────────────────────
function parseEmUServices() {
  const csvPath = path.join(CSV_DIR, 'EmU_Services.csv');
  if (!fs.existsSync(csvPath)) return [];
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csvContent, { relax_column_count: true, skip_empty_lines: false });

  const services = [];
  let currentService = null;

  for (const row of rows) {
    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();
    const col2 = (row[2] || '').trim();
    const col3 = (row[3] || '').trim();

    if (col0 && !col1) {
      // Service header
      currentService = { name: col0, description: '', link: '', contact: '' };
      services.push(currentService);
    } else if (col1 && currentService) {
      currentService.description = col1;
      currentService.link = col2;
      currentService.contact = col3;
    }
  }

  return services;
}

// ──────────────────────────────────────────────
// PREPAREDNESS LIBRARY
// ──────────────────────────────────────────────
function parsePreparednessLibrary() {
  const csvPath = path.join(CSV_DIR, 'Preparedness_Library.csv');
  if (!fs.existsSync(csvPath)) return [];
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const rows = parse(csvContent, { relax_column_count: true, skip_empty_lines: false });

  const items = [];
  let currentCategory = '';

  for (const row of rows) {
    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();

    if (col0 === 'Preparedness Library') continue;
    if (col0 && !col1) {
      currentCategory = col0;
    } else if (col1) {
      items.push({ category: currentCategory || col0, name: col1, link: '' });
    }
  }

  return items;
}

// ──────────────────────────────────────────────
// GUIDELINES TEXT → CHUNKS
// ──────────────────────────────────────────────
function parseGuidelines() {
  const guidelinesPath = path.join(ROOT, 'guidelines-text.md');
  if (!fs.existsSync(guidelinesPath)) return [];

  const text = fs.readFileSync(guidelinesPath, 'utf-8');
  const sections = [];
  let currentSection = { title: 'Introduction', content: '' };

  for (const line of text.split('\n')) {
    // Detect section headers (numbered sections like "1. Introduction", "2. Vision")
    const sectionMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (sectionMatch) {
      if (currentSection.content.trim()) {
        sections.push({ ...currentSection, content: currentSection.content.trim() });
      }
      currentSection = { title: `${sectionMatch[1]}. ${sectionMatch[2]}`, content: '' };
    } else {
      currentSection.content += line + '\n';
    }
  }
  if (currentSection.content.trim()) {
    sections.push({ ...currentSection, content: currentSection.content.trim() });
  }

  return sections;
}

// ──────────────────────────────────────────────
// MAIN BUILD
// ──────────────────────────────────────────────
function build() {
  console.log('📦 Building process data...\n');

  const sectors = [];

  // Parse each sector CSV
  for (const [key, config] of Object.entries(SECTOR_MAP)) {
    const csvPath = path.join(CSV_DIR, config.csvFile);
    if (!fs.existsSync(csvPath)) {
      console.log(`  ⚠️  Skipping ${config.name}: ${config.csvFile} not found`);
      continue;
    }

    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    let result;

    switch (config.format) {
      case 'rmie':
        result = parseRMiECSV(csvContent, config.id);
        break;
      case 'pcie':
        result = parsePCiECSV(csvContent, config.id);
        break;
      case 'response_mgmt':
        result = parseResponseMgmtCSV(csvContent, config.id);
        break;
      case 'safeguarding':
        result = parseSafeguardingCSV(csvContent, config.id);
        break;
      case 'integra':
        result = parseIntegraCSV(csvContent, config.id);
        break;
      default:
        result = parseStandardCSV(csvContent, config.id);
    }

    // Assign phase to PCiE tasks based on section/position
    if (config.format === 'pcie') {
      let currentPhase = 'R1';
      for (const task of result.tasks) {
        const section = (task.section || '').toUpperCase();
        if (section.includes('LABOR') || section.includes('IDENTIFY')) task.phase = 'R1';
        else if (section.includes('STAFFING') || section.includes('COMPENSATION') || section.includes('RECRUITMENT')) task.phase = 'R3';
        else if (section.includes('ONBOARDING') || section.includes('HANDBOOK')) task.phase = 'R4';
      }
    }

    sectors.push({
      id: config.id,
      name: config.name,
      contacts: result.contacts,
      tasks: result.tasks,
    });

    console.log(`  ✅ ${config.name}: ${result.tasks.length} tasks parsed`);
  }

  // Merge duplicate sectors (People & Culture has two tabs)
  const mergedSectors = [];
  const sectorIndex = {};
  for (const sector of sectors) {
    // Merge people_culture and pcie into one
    const mergeId = sector.id === 'pcie' ? 'people_culture' : sector.id;
    if (sectorIndex[mergeId] !== undefined) {
      const existing = mergedSectors[sectorIndex[mergeId]];
      // Deduplicate tasks by title
      const existingTitles = new Set(existing.tasks.map(t => t.title.toLowerCase()));
      for (const task of sector.tasks) {
        if (!existingTitles.has(task.title.toLowerCase())) {
          existing.tasks.push(task);
        }
      }
      existing.contacts = [...existing.contacts, ...sector.contacts];
    } else {
      sectorIndex[mergeId] = mergedSectors.length;
      mergedSectors.push({ ...sector, id: mergeId });
    }
  }

  // Also merge response_mgmt into rmie
  const rmieIdx = mergedSectors.findIndex(s => s.id === 'rmie');
  const rmIdx = mergedSectors.findIndex(s => s.id === 'response_mgmt');
  if (rmieIdx >= 0 && rmIdx >= 0) {
    const rmie = mergedSectors[rmieIdx];
    const rm = mergedSectors[rmIdx];
    const existingTitles = new Set(rmie.tasks.map(t => t.title.toLowerCase()));
    for (const task of rm.tasks) {
      if (!existingTitles.has(task.title.toLowerCase())) {
        rmie.tasks.push(task);
      }
    }
    rmie.contacts = [...rmie.contacts, ...rm.contacts];
    mergedSectors.splice(rmIdx, 1);
  }

  // Parse guidelines
  const guidelines = parseGuidelines();
  console.log(`\n  ✅ Guidelines: ${guidelines.length} sections parsed`);

  // Parse annexes
  const annexes = buildAnnexList();
  console.log(`  ✅ Annexes: ${annexes.length} documents indexed`);

  // Parse EmU services
  const emuServices = parseEmUServices();
  console.log(`  ✅ EmU Services: ${emuServices.length} services parsed`);

  // Parse preparedness library
  const preparednessLibrary = parsePreparednessLibrary();
  console.log(`  ✅ Preparedness Library: ${preparednessLibrary.length} items parsed`);

  // Count total tasks
  const totalTasks = mergedSectors.reduce((sum, s) => sum + s.tasks.length, 0);
  const totalSubtasks = mergedSectors.reduce((sum, s) => sum + s.tasks.reduce((sum2, t) => sum2 + t.subtasks.length, 0), 0);

  // Build full data object
  const processData = {
    phases: PHASES,
    sectors: mergedSectors,
    guidelines,
    annexes,
    emuServices,
    preparednessLibrary,
    metadata: {
      buildDate: new Date().toISOString(),
      totalSectors: mergedSectors.length,
      totalTasks,
      totalSubtasks,
      totalResources: annexes.length,
    },
  };

  // Build search chunks for RAG
  const searchChunks = [];

  // Add task chunks
  for (const sector of mergedSectors) {
    for (const task of sector.tasks) {
      const subtaskText = task.subtasks.map(s => `- ${s.title}`).join('\n');
      const resourceText = [...task.resources, ...task.subtasks.flatMap(s => s.resources)].map(r => r.name).join(', ');

      searchChunks.push({
        id: task.id,
        type: 'task',
        sector: sector.name,
        sectorId: sector.id,
        phase: task.phase,
        title: task.title,
        content: `[${sector.name}] [${task.phase}] ${task.title}\n${subtaskText}\nClassification: ${task.classification.join(', ')}\nOffice: ${task.officeType}\nPriority: ${task.priority}\nTimeline: ${task.timeline}\n${resourceText ? 'Resources: ' + resourceText : ''}`.trim(),
        classification: task.classification,
        officeType: task.officeType,
        priority: task.priority,
      });
    }
  }

  // Add guideline chunks
  for (const section of guidelines) {
    // Break long sections into ~500 word chunks
    const words = section.content.split(/\s+/);
    const chunkSize = 500;
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      searchChunks.push({
        id: `guide-${section.title.replace(/\s+/g, '-').toLowerCase()}-${Math.floor(i / chunkSize)}`,
        type: 'guideline',
        sector: 'guidelines',
        sectorId: 'guidelines',
        phase: '',
        title: section.title,
        content: `[Emergency Management Guidelines] ${section.title}\n${chunk}`,
        classification: ['red', 'orange', 'yellow'],
        officeType: 'both',
        priority: 'high',
      });
    }
  }

  // Add annex chunks
  for (const annex of annexes) {
    searchChunks.push({
      id: annex.id,
      type: 'resource',
      sector: annex.sectors[0] || 'response_mgmt',
      sectorId: annex.sectors[0] || 'response_mgmt',
      phase: annex.phases[0] || '',
      title: annex.name,
      content: `[Resource] ${annex.name} (${annex.fileType})\n${annex.description}\nSectors: ${annex.sectors.join(', ')}\nPhases: ${annex.phases.join(', ')}`,
      classification: ['red', 'orange', 'yellow'],
      officeType: 'both',
      priority: 'medium',
    });
  }

  // Write output files
  fs.mkdirSync(OUT_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(OUT_DIR, 'process-data.json'),
    JSON.stringify(processData, null, 2)
  );

  fs.writeFileSync(
    path.join(OUT_DIR, 'search-chunks.json'),
    JSON.stringify(searchChunks, null, 2)
  );

  console.log(`\n✅ Build complete!`);
  console.log(`   ${mergedSectors.length} sectors, ${totalTasks} tasks, ${totalSubtasks} subtasks`);
  console.log(`   ${searchChunks.length} search chunks generated`);
  console.log(`   Output: src/data/process-data.json (${(JSON.stringify(processData).length / 1024).toFixed(0)}KB)`);
  console.log(`   Output: src/data/search-chunks.json (${(JSON.stringify(searchChunks).length / 1024).toFixed(0)}KB)`);
}

build();
