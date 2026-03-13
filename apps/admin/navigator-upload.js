'use strict';

// ──────────────────────────────────────────────
// SHEET → SECTOR MAPPING
// ──────────────────────────────────────────────
var SHEET_MAP = {
  'RMiE':                        { id: 'rmie',              name: 'Response Management',         format: 'rmie' },
  'Response Management':         { id: 'response_mgmt',     name: 'Response Management (Overview)', format: 'response_mgmt' },
  'Response Management (WIP)':   { id: 'response_mgmt',     name: 'Response Management (Overview)', format: 'response_mgmt' },
  'Finance':                     { id: 'finance',           name: 'Finance',                     format: 'standard' },
  'People & Culture':            { id: 'people_culture',    name: 'People & Culture',            format: 'standard' },
  'PCiE':                        { id: 'pcie',              name: 'People & Culture in Emergencies', format: 'pcie' },
  'Supply Chain':                { id: 'supply_chain',      name: 'Supply Chain',                format: 'standard' },
  'Safety & Security':           { id: 'safety_security',   name: 'Safety & Security',           format: 'standard' },
  'Safeguarding':                { id: 'safeguarding',      name: 'Safeguarding',                format: 'standard' },
  'Technical Programs':          { id: 'technical_programs', name: 'Technical Programs',          format: 'standard' },
  'MEAL':                        { id: 'meal',              name: 'MEAL',                        format: 'standard' },
  'Grants':                      { id: 'grants',            name: 'Grants',                      format: 'standard' },
  'Partnerships':                { id: 'partnerships',      name: 'Partnerships',                format: 'standard' },
  'Integra Launch':              { id: 'integra',           name: 'Integra Launch',              format: 'integra' },
  'EmU Services':                { id: '_emu',              name: 'EmU Services',                format: 'emu' },
  'Preparedness Library':        { id: '_preparedness',     name: 'Preparedness Library',        format: 'preparedness' }
};

// Response phases (must match build-data.mjs exactly)
var PHASES = [
  { id: 'R1', name: 'Emergency Onset', description: 'Crisis monitoring, classification, Go/No-Go decision, initial deployments', timeline: 'Week 0-1' },
  { id: 'R2', name: 'Context Analysis', description: 'Multi-sector needs assessment, situation analysis, feasibility assessment', timeline: 'Week 1-2' },
  { id: 'R3', name: 'Strategy Development', description: 'Response strategy, program design, partnership and funding strategy', timeline: 'Week 2-3' },
  { id: 'R4', name: 'Response Planning', description: 'Response plan, budget development, logframe, staffing plan, procurement', timeline: 'Week 3-4' },
  { id: 'R5', name: 'Implementation', description: 'Program delivery, operations setup, procurement, monitoring', timeline: 'Month 1-3' },
  { id: 'R6', name: 'Learnings', description: 'After-action review, real-time evaluations, case studies', timeline: 'Month 3+' },
  { id: 'R7', name: 'Transition & Handover', description: 'Transition planning, handover to long-term programming, documentation', timeline: 'Month 3-6+' }
];

// ──────────────────────────────────────────────
// UTILITY HELPERS
// ──────────────────────────────────────────────

function cell(row, idx) {
  var v = row[idx];
  return (v == null) ? '' : String(v).trim();
}

function detectPhase(text) {
  if (!text) return null;
  var m = text.match(/R(\d)/i);
  return m ? 'R' + m[1] : null;
}

function parseClassification(text) {
  if (!text) return ['red', 'orange', 'yellow'];
  var t = text.toLowerCase();
  var result = [];
  if (t.includes('red')) result.push('red');
  if (t.includes('orange')) result.push('orange');
  if (t.includes('yellow')) result.push('yellow');
  return result.length ? result : ['red', 'orange', 'yellow'];
}

function detectOfficeType(text) {
  if (!text) return 'both';
  var t = text.toLowerCase();
  if (t.includes('new') && t.includes('existing')) return 'both';
  if (t.includes('new')) return 'new';
  if (t.includes('existing')) return 'existing';
  return 'both';
}

function detectPriority(priorityText, milestoneText) {
  var p = (priorityText || '').toLowerCase();
  var m = (milestoneText || '').toLowerCase();
  if (m === 'yes' || m === 'y' || m === 'x' || m.includes('key')) return 'key';
  if (p.includes('high') || p === 'h') return 'high';
  if (p.includes('medium') || p === 'm') return 'medium';
  if (p.includes('low') || p === 'l') return 'low';
  return 'medium';
}

function guessResourceType(name) {
  var n = (name || '').toLowerCase();
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

function isPlaceholder(text) {
  var t = (text || '').toLowerCase();
  return t.startsWith('[task') || t.startsWith('[subtask') || t.startsWith('[link') || t === 'example' || t.startsWith('[template');
}

function getHyperlink(sheet, ref) {
  var c = sheet[ref];
  if (c && c.l && c.l.Target) {
    var url = c.l.Target;
    if (url.startsWith('mailto:')) return null;
    return url;
  }
  return null;
}

function cellRef(row, col) {
  var letter = '';
  var c = col;
  while (c >= 0) {
    letter = String.fromCharCode(65 + (c % 26)) + letter;
    c = Math.floor(c / 26) - 1;
  }
  return letter + (row + 1);
}

function extractContacts(rows) {
  var contacts = [];
  var limit = Math.min(rows.length, 8);
  for (var r = 0; r < limit; r++) {
    var text = rows[r].join(' ');
    var emailMatch = text.match(/[\w.+-]+@[\w.-]+\.\w+/);
    if (emailMatch) {
      var email = emailMatch[0];
      var nameCol = '';
      for (var c = 0; c < rows[r].length; c++) {
        var cv = String(rows[r][c] || '');
        if (cv && !cv.includes('@') && !cv.includes('Contact') && !cv.includes('support') && !cv.includes('Tab') && cv.trim().length > 2) {
          nameCol = cv.trim();
          break;
        }
      }
      if (nameCol) contacts.push({ name: nameCol, title: '', email: email });
    }
  }
  return contacts;
}

function findHeaderRow(rows, pattern) {
  for (var i = 0; i < Math.min(rows.length, 20); i++) {
    var text = rows[i].join(' ').toLowerCase();
    if (pattern(text)) return i;
  }
  return -1;
}

// ──────────────────────────────────────────────
// STANDARD FORMAT PARSER
// Finance, People & Culture, Supply Chain, Safety & Security,
// Safeguarding, Technical Programs, MEAL, Grants, Partnerships
// Columns: [0] Response Stage, [1] New/Existing, [2] Classification,
// [3] Responsible, [4] Priority, [5] Key Milestone, [6] Timeline,
// [7] Status, [8] Task, [9] Subtask, [10] Resources, [11] Box Link
// ──────────────────────────────────────────────
function parseStandardSheet(sheet, sectorId) {
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  var contacts = extractContacts(rows);

  var headerIdx = findHeaderRow(rows, function(text) {
    return text.includes('response stage') && (text.includes('task') || text.includes('subtask'));
  });
  if (headerIdx === -1) return { tasks: [], contacts: contacts, resources: [] };

  var tasks = [];
  var currentTask = null;
  var currentPhase = null;
  var taskCounter = 0;
  var allResources = [];

  for (var r = headerIdx + 2; r < rows.length; r++) {
    var row = rows[r];
    if (!row || row.every(function(c) { return !c || !String(c).trim(); })) continue;

    var responseStage = cell(row, 0);
    var taskTitle = cell(row, 8);
    var subtaskTitle = cell(row, 9);
    var resourceName = cell(row, 10);

    var detectedPhase = detectPhase(responseStage);
    if (detectedPhase) {
      currentPhase = detectedPhase;
      if (!taskTitle && !subtaskTitle) continue;
    }

    if (isPlaceholder(taskTitle) || isPlaceholder(subtaskTitle)) continue;

    var resourceUrl = getHyperlink(sheet, cellRef(r, 10)) || '';
    var boxUrl = getHyperlink(sheet, cellRef(r, 11)) || '';
    var url = boxUrl || resourceUrl;

    if (taskTitle && !taskTitle.startsWith('[')) {
      taskCounter++;
      currentTask = {
        id: sectorId.toUpperCase() + '-' + String(taskCounter).padStart(3, '0'),
        title: taskTitle,
        phase: currentPhase || 'R1',
        classification: parseClassification(cell(row, 2)),
        officeType: detectOfficeType(cell(row, 1)),
        priority: detectPriority(cell(row, 4), cell(row, 5)),
        keyMilestone: !!(cell(row, 5) && cell(row, 5).toLowerCase().includes('key')),
        timeline: cell(row, 6),
        responsible: cell(row, 3),
        subtasks: [],
        resources: []
      };
      tasks.push(currentTask);

      // Subtask on same row as task
      if (subtaskTitle && !subtaskTitle.startsWith('[')) {
        currentTask.subtasks.push({
          id: currentTask.id + '.' + (currentTask.subtasks.length + 1),
          title: subtaskTitle,
          resources: []
        });
      }

      if (resourceName && !resourceName.startsWith('[')) {
        var res = { name: resourceName, url: url, type: guessResourceType(resourceName) };
        if (currentTask.subtasks.length > 0) {
          currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(res);
        } else {
          currentTask.resources.push(res);
        }
        if (url) allResources.push({ name: resourceName, url: url, sector: sectorId, task: taskTitle });
      }
    } else if (subtaskTitle && currentTask && !subtaskTitle.startsWith('[')) {
      currentTask.subtasks.push({
        id: currentTask.id + '.' + (currentTask.subtasks.length + 1),
        title: subtaskTitle,
        resources: []
      });
      if (resourceName && !resourceName.startsWith('[')) {
        var subRes = { name: resourceName, url: url, type: guessResourceType(resourceName) };
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(subRes);
        if (url) allResources.push({ name: resourceName, url: url, sector: sectorId, task: currentTask.title, subtask: subtaskTitle });
      }
    } else if (resourceName && currentTask && !resourceName.startsWith('[')) {
      var resOnly = { name: resourceName, url: url, type: guessResourceType(resourceName) };
      if (currentTask.subtasks.length > 0) {
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(resOnly);
      } else {
        currentTask.resources.push(resOnly);
      }
      if (url) allResources.push({ name: resourceName, url: url, sector: sectorId, task: currentTask.title });
    }
  }

  return { tasks: tasks, contacts: contacts, resources: allResources };
}

// ──────────────────────────────────────────────
// RMiE FORMAT PARSER
// Columns: [1] Task ID, [2] Task Title, [3] Resource Link,
// [4] Task Owner, [5] New Office Only, [6] Key Milestone,
// [7] Priority, [8] Response Stage, [9] Timeline
// ──────────────────────────────────────────────
function parseRMiESheet(sheet, sectorId) {
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  var contacts = extractContacts(rows);

  var headerIdx = findHeaderRow(rows, function(text) {
    return text.includes('task') && (text.includes('id') || text.includes('title'));
  });
  if (headerIdx === -1) return { tasks: [], contacts: contacts, resources: [] };

  var tasks = [];
  var currentTask = null;
  var currentSection = '';
  var allResources = [];

  for (var r = headerIdx + 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || row.every(function(c) { return !c || !String(c).trim(); })) continue;

    var taskId = cell(row, 1);
    var title = cell(row, 2);
    var resourceText = cell(row, 3);
    var owner = cell(row, 4);
    var newOffice = cell(row, 5);
    var keyMilestone = cell(row, 6);
    var priorityLevel = cell(row, 7);

    if (!taskId && !title && !resourceText) continue;
    if (isPlaceholder(title)) continue;

    if (taskId && !taskId.includes('.') && title && title === title.toUpperCase() && !keyMilestone && !cell(row, 9)) {
      currentSection = title;
      continue;
    }

    var resourceUrl = getHyperlink(sheet, cellRef(r, 3)) || '';
    var isMainTask = taskId && /^\d+$/.test(taskId) && title;
    var isSubtask = taskId && /^\d+\.\d+/.test(taskId);

    if (isMainTask) {
      currentTask = {
        id: sectorId.toUpperCase() + '-' + String(taskId).padStart(3, '0'),
        title: title,
        phase: detectPhase(cell(row, 8)) || 'R1',
        classification: ['red', 'orange', 'yellow'],
        officeType: newOffice.toLowerCase().includes('new') ? 'new' : 'both',
        priority: detectPriority(priorityLevel, keyMilestone),
        keyMilestone: !!(keyMilestone && keyMilestone.toLowerCase().includes('key')),
        timeline: cell(row, 9),
        responsible: owner,
        section: currentSection,
        subtasks: [],
        resources: []
      };
      tasks.push(currentTask);

      if (resourceText && !resourceText.startsWith('[')) {
        currentTask.resources.push({ name: resourceText, url: resourceUrl, type: guessResourceType(resourceText) });
        if (resourceUrl) allResources.push({ name: resourceText, url: resourceUrl, sector: sectorId, task: title });
      }
    } else if (isSubtask && currentTask) {
      var sub = {
        id: currentTask.id + '.' + (currentTask.subtasks.length + 1),
        title: title,
        resources: []
      };
      if (resourceText && !resourceText.startsWith('[')) {
        sub.resources.push({ name: resourceText, url: resourceUrl, type: guessResourceType(resourceText) });
        if (resourceUrl) allResources.push({ name: resourceText, url: resourceUrl, sector: sectorId, task: currentTask.title, subtask: title });
      }
      currentTask.subtasks.push(sub);
    }
  }

  return { tasks: tasks, contacts: contacts, resources: allResources };
}

// ──────────────────────────────────────────────
// PCiE FORMAT PARSER (dedicated — different column layout from RMiE)
// Columns: [1] Task ID, [2] Task Title, [3] Resource Link,
// [4] Task Owner, [5] New Office Only, [6] Key Milestone,
// [7] Priority, [8] Timeline
// NOTE: NO Response Stage column — col 8 is Timeline, NOT Response Stage
// ──────────────────────────────────────────────
function parsePCiESheet(sheet, sectorId) {
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  var contacts = extractContacts(rows);

  var headerIdx = findHeaderRow(rows, function(text) {
    return text.includes('task') && (text.includes('id') || text.includes('title'));
  });
  if (headerIdx === -1) return { tasks: [], contacts: contacts, resources: [] };

  var tasks = [];
  var currentTask = null;
  var currentSection = '';
  var allResources = [];

  for (var r = headerIdx + 1; r < rows.length; r++) {
    var row = rows[r];
    if (!row || row.every(function(c) { return !c || !String(c).trim(); })) continue;

    var taskId = cell(row, 1);
    var title = cell(row, 2);
    var resourceText = cell(row, 3);
    var owner = cell(row, 4);
    var newOffice = cell(row, 5);
    var keyMilestone = cell(row, 6);
    var priorityLevel = cell(row, 7);
    var timeline = cell(row, 8); // Col 8 is Timeline, NOT Response Stage

    if (!taskId && !title && !resourceText) continue;
    if (isPlaceholder(title)) continue;

    if (taskId && !taskId.includes('.') && title && title === title.toUpperCase() && !keyMilestone && !timeline) {
      currentSection = title;
      continue;
    }

    var resourceUrl = getHyperlink(sheet, cellRef(r, 3)) || '';
    var isMainTask = taskId && /^\d+$/.test(taskId) && title;
    var isSubtask = taskId && /^\d+\.\d+/.test(taskId);

    if (isMainTask) {
      currentTask = {
        id: 'PCIE-' + String(taskId).padStart(3, '0'),
        title: title,
        phase: 'R1',
        classification: ['red', 'orange', 'yellow'],
        officeType: newOffice.toLowerCase().includes('new') ? 'new' : 'both',
        priority: detectPriority(priorityLevel, keyMilestone),
        keyMilestone: !!(keyMilestone && keyMilestone.toLowerCase().includes('key')),
        timeline: timeline,
        responsible: owner,
        section: currentSection,
        subtasks: [],
        resources: []
      };
      tasks.push(currentTask);

      if (resourceText && !resourceText.startsWith('[')) {
        currentTask.resources.push({ name: resourceText, url: resourceUrl, type: guessResourceType(resourceText) });
        if (resourceUrl) allResources.push({ name: resourceText, url: resourceUrl, sector: sectorId, task: title });
      }
    } else if (isSubtask && currentTask) {
      var sub = {
        id: currentTask.id + '.' + (currentTask.subtasks.length + 1),
        title: title,
        resources: []
      };
      if (resourceText && !resourceText.startsWith('[')) {
        sub.resources.push({ name: resourceText, url: resourceUrl, type: guessResourceType(resourceText) });
        if (resourceUrl) allResources.push({ name: resourceText, url: resourceUrl, sector: sectorId, task: currentTask.title, subtask: title });
      }
      currentTask.subtasks.push(sub);
    }
  }

  // Post-parse phase assignment based on section names
  for (var i = 0; i < tasks.length; i++) {
    var section = (tasks[i].section || '').toUpperCase();
    if (section.includes('LABOR') || section.includes('IDENTIFY')) tasks[i].phase = 'R1';
    else if (section.includes('STAFFING') || section.includes('COMPENSATION') || section.includes('RECRUITMENT')) tasks[i].phase = 'R3';
    else if (section.includes('ONBOARDING') || section.includes('HANDBOOK')) tasks[i].phase = 'R4';
  }

  return { tasks: tasks, contacts: contacts, resources: allResources };
}

// ──────────────────────────────────────────────
// RESPONSE MANAGEMENT PARSER
// Columns: [0] Counter, [1] Response Stage, [2] New/Existing,
// [3] Classification, [4] Responsible, [5] Key Milestone,
// [6] Priority, [7] Status, [8] Tasks, [9] Subtasks,
// [10] Resources, [11] Box Link
// ──────────────────────────────────────────────
function parseResponseMgmtSheet(sheet, sectorId) {
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  var contacts = extractContacts(rows);

  var headerIdx = findHeaderRow(rows, function(text) {
    return text.includes('response stage') && (text.includes('task') || text.includes('subtask'));
  });
  if (headerIdx === -1) return { tasks: [], contacts: contacts, resources: [] };

  var tasks = [];
  var currentTask = null;
  var taskCounter = 0;
  var currentPhase = null;
  var allResources = [];

  for (var r = headerIdx + 2; r < rows.length; r++) {
    var row = rows[r];
    if (!row || row.every(function(c) { return !c || !String(c).trim(); })) continue;

    var responseStage = cell(row, 1);
    var taskTitle = cell(row, 8);
    var subtaskTitle = cell(row, 9);
    var resourceName = cell(row, 10);

    var detectedPhase = detectPhase(responseStage);
    if (detectedPhase) {
      currentPhase = detectedPhase;
      if (!taskTitle && !subtaskTitle) continue;
    }

    if (!taskTitle && !subtaskTitle && !resourceName) continue;
    if (isPlaceholder(taskTitle) || isPlaceholder(subtaskTitle)) continue;

    var resourceUrl = getHyperlink(sheet, cellRef(r, 10)) || '';
    var boxUrl = getHyperlink(sheet, cellRef(r, 11)) || '';
    var url = boxUrl || resourceUrl;

    if (taskTitle && !taskTitle.startsWith('[')) {
      taskCounter++;
      currentTask = {
        id: 'RESPONSE_MGMT-' + String(taskCounter).padStart(3, '0'),
        title: taskTitle,
        phase: currentPhase || 'R1',
        classification: parseClassification(cell(row, 3)),
        officeType: detectOfficeType(cell(row, 2)),
        priority: detectPriority(cell(row, 6), cell(row, 5)),
        keyMilestone: !!(cell(row, 5) && cell(row, 5).toLowerCase().includes('key')),
        timeline: '',
        responsible: cell(row, 4),
        subtasks: [],
        resources: []
      };
      tasks.push(currentTask);

      if (subtaskTitle && !subtaskTitle.startsWith('[')) {
        currentTask.subtasks.push({
          id: currentTask.id + '.' + (currentTask.subtasks.length + 1),
          title: subtaskTitle,
          resources: []
        });
      }

      if (resourceName && !resourceName.startsWith('[')) {
        var res = { name: resourceName, url: url, type: guessResourceType(resourceName) };
        if (currentTask.subtasks.length > 0) {
          currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(res);
        } else {
          currentTask.resources.push(res);
        }
        if (url) allResources.push({ name: resourceName, url: url, sector: sectorId, task: taskTitle });
      }
    } else if (subtaskTitle && currentTask && !subtaskTitle.startsWith('[')) {
      currentTask.subtasks.push({
        id: currentTask.id + '.' + (currentTask.subtasks.length + 1),
        title: subtaskTitle,
        resources: []
      });
      if (resourceName && !resourceName.startsWith('[')) {
        var subRes = { name: resourceName, url: url, type: guessResourceType(resourceName) };
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(subRes);
        if (url) allResources.push({ name: resourceName, url: url, sector: sectorId, task: currentTask.title, subtask: subtaskTitle });
      }
    } else if (resourceName && currentTask && !resourceName.startsWith('[')) {
      var resOnly = { name: resourceName, url: url, type: guessResourceType(resourceName) };
      if (currentTask.subtasks.length > 0) {
        currentTask.subtasks[currentTask.subtasks.length - 1].resources.push(resOnly);
      } else {
        currentTask.resources.push(resOnly);
      }
      if (url) allResources.push({ name: resourceName, url: url, sector: sectorId, task: currentTask.title });
    }
  }

  return { tasks: tasks, contacts: contacts, resources: allResources };
}

// ──────────────────────────────────────────────
// INTEGRA LAUNCH PARSER
// Columns: [1] Status, [2] Timetable, [3] Task, [4] Subtask,
// [5] Task Owner, [6] Oversight, [7] Resource
// ──────────────────────────────────────────────
function parseIntegraSheet(sheet, sectorId) {
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  var contacts = extractContacts(rows);
  var tasks = [];
  var currentTask = null;
  var taskCounter = 0;
  var currentSection = '';
  var allResources = [];

  var headerIdx = findHeaderRow(rows, function(text) {
    return text.includes('task') && text.includes('status');
  });
  var startRow = headerIdx >= 0 ? headerIdx + 1 : 0;

  for (var r = startRow; r < rows.length; r++) {
    var row = rows[r];
    var taskTitle = cell(row, 3);
    var subtaskTitle = cell(row, 4);
    var timetable = cell(row, 2);
    var owner = cell(row, 5);
    var resourceName = cell(row, 7);

    if (!taskTitle && !subtaskTitle && !resourceName) continue;
    if (isPlaceholder(taskTitle)) continue;

    if (taskTitle && !subtaskTitle && !owner && !timetable) {
      currentSection = taskTitle;
      continue;
    }

    var resourceUrl = getHyperlink(sheet, cellRef(r, 7)) || '';

    if (taskTitle && timetable) {
      taskCounter++;
      currentTask = {
        id: 'INTEGRA-' + String(taskCounter).padStart(3, '0'),
        title: taskTitle,
        phase: 'R4',
        classification: ['red', 'orange', 'yellow'],
        officeType: 'new',
        priority: 'high',
        keyMilestone: false,
        timeline: timetable,
        responsible: owner,
        section: currentSection,
        subtasks: [],
        resources: []
      };
      tasks.push(currentTask);

      if (resourceName && resourceUrl) {
        currentTask.resources.push({ name: resourceName, url: resourceUrl, type: guessResourceType(resourceName) });
        allResources.push({ name: resourceName, url: resourceUrl, sector: sectorId, task: taskTitle });
      }
    } else if (subtaskTitle && currentTask) {
      var sub = {
        id: currentTask.id + '.' + (currentTask.subtasks.length + 1),
        title: subtaskTitle,
        resources: []
      };
      if (resourceName && resourceUrl) {
        sub.resources.push({ name: resourceName, url: resourceUrl, type: guessResourceType(resourceName) });
        allResources.push({ name: resourceName, url: resourceUrl, sector: sectorId, task: currentTask.title, subtask: subtaskTitle });
      }
      currentTask.subtasks.push(sub);
    }
  }

  return { tasks: tasks, contacts: contacts, resources: allResources };
}

// ──────────────────────────────────────────────
// EmU SERVICES PARSER
// ──────────────────────────────────────────────
function parseEmUSheet(sheet) {
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  var services = [];
  var currentService = null;

  for (var r = 0; r < rows.length; r++) {
    var col0 = cell(rows[r], 0);
    var col1 = cell(rows[r], 1);
    var col2 = cell(rows[r], 2);
    var col3 = cell(rows[r], 3);

    if (col0 && !col1) {
      currentService = { name: col0, description: '', link: '', contact: '' };
      services.push(currentService);
    } else if (col1 && currentService) {
      currentService.description = col1;
      currentService.link = col2 || getHyperlink(sheet, cellRef(r, 2)) || '';
      currentService.contact = col3;
    }
  }
  return services;
}

// ──────────────────────────────────────────────
// PREPAREDNESS LIBRARY PARSER
// ──────────────────────────────────────────────
function parsePreparednessSheet(sheet) {
  var rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  var items = [];
  var currentCategory = '';

  for (var r = 0; r < rows.length; r++) {
    var col0 = cell(rows[r], 0);
    var col1 = cell(rows[r], 1);

    if (col0 === 'Preparedness Library') continue;
    if (col0 && !col1) {
      currentCategory = col0;
    } else if (col1) {
      items.push({ category: currentCategory || col0, name: col1, link: getHyperlink(sheet, cellRef(r, 1)) || '' });
    }
  }
  return items;
}

// ──────────────────────────────────────────────
// SECTOR MERGING
// ──────────────────────────────────────────────
function mergeSectors(sectors) {
  var merged = [];
  var index = {};

  for (var i = 0; i < sectors.length; i++) {
    var sector = sectors[i];
    var mergeId = sector.id === 'pcie' ? 'people_culture' : sector.id === 'response_mgmt' ? 'rmie' : sector.id;
    var mergeName = mergeId === 'people_culture' ? 'People & Culture' : mergeId === 'rmie' ? 'Response Management' : sector.name;

    if (index[mergeId] !== undefined) {
      var existing = merged[index[mergeId]];
      var existingTitles = {};
      for (var j = 0; j < existing.tasks.length; j++) {
        existingTitles[existing.tasks[j].title.toLowerCase()] = true;
      }
      for (var k = 0; k < sector.tasks.length; k++) {
        if (!existingTitles[sector.tasks[k].title.toLowerCase()]) {
          existing.tasks.push(sector.tasks[k]);
        }
      }
      existing.contacts = existing.contacts.concat(sector.contacts);
    } else {
      index[mergeId] = merged.length;
      merged.push({ id: mergeId, name: mergeName, contacts: sector.contacts.slice(), tasks: sector.tasks.slice() });
    }
  }
  return merged;
}

// ──────────────────────────────────────────────
// RESOURCE DEDUPLICATION
// ──────────────────────────────────────────────
function deduplicateResources(sectors) {
  for (var i = 0; i < sectors.length; i++) {
    for (var j = 0; j < sectors[i].tasks.length; j++) {
      var task = sectors[i].tasks[j];
      var subtaskUrls = {};

      for (var s = 0; s < task.subtasks.length; s++) {
        var seen = {};
        var dedupedSub = [];
        for (var r = 0; r < task.subtasks[s].resources.length; r++) {
          var res = task.subtasks[s].resources[r];
          if (!seen[res.url]) {
            seen[res.url] = true;
            dedupedSub.push(res);
            subtaskUrls[res.url] = true;
          }
        }
        task.subtasks[s].resources = dedupedSub;
      }

      var taskSeen = {};
      var dedupedTask = [];
      for (var t = 0; t < task.resources.length; t++) {
        var tr = task.resources[t];
        if (!subtaskUrls[tr.url] && !taskSeen[tr.url]) {
          taskSeen[tr.url] = true;
          dedupedTask.push(tr);
        }
      }
      task.resources = dedupedTask;
    }
  }
}

// ──────────────────────────────────────────────
// SEARCH CHUNK GENERATION
// ──────────────────────────────────────────────
function generateSearchChunks(sectors, guidelines) {
  var chunks = [];

  for (var i = 0; i < sectors.length; i++) {
    var sector = sectors[i];
    for (var j = 0; j < sector.tasks.length; j++) {
      var task = sector.tasks[j];
      var contentParts = ['Task: ' + task.title];
      if (task.section) contentParts.push('Section: ' + task.section);
      if (task.responsible) contentParts.push('Responsible: ' + task.responsible);

      for (var s = 0; s < task.subtasks.length; s++) {
        contentParts.push('- ' + task.subtasks[s].title);
      }

      var allRes = task.resources.slice();
      for (var s2 = 0; s2 < task.subtasks.length; s2++) {
        allRes = allRes.concat(task.subtasks[s2].resources);
      }
      for (var r = 0; r < allRes.length; r++) {
        contentParts.push('Resource: ' + allRes[r].name + (allRes[r].url ? ' (' + allRes[r].url + ')' : ''));
      }

      chunks.push({
        id: task.id,
        type: 'task',
        sector: sector.name,
        sectorId: sector.id,
        phase: task.phase,
        title: task.title,
        content: contentParts.join('\n'),
        classification: task.classification,
        officeType: task.officeType,
        priority: task.priority
      });
    }
  }

  if (guidelines && guidelines.length) {
    for (var g = 0; g < guidelines.length; g++) {
      var section = guidelines[g];
      var words = section.content.split(/\s+/);
      var chunkSize = 500;
      for (var w = 0; w < words.length; w += chunkSize) {
        var chunkText = words.slice(w, w + chunkSize).join(' ');
        chunks.push({
          id: 'guide-' + section.title.replace(/\s+/g, '-').toLowerCase() + '-' + Math.floor(w / chunkSize),
          type: 'guideline',
          sector: 'guidelines',
          sectorId: 'guidelines',
          phase: 'R1',
          title: section.title,
          content: section.title + '\n' + chunkText,
          classification: ['red', 'orange', 'yellow'],
          officeType: 'both',
          priority: 'high'
        });
      }
    }
  }

  return chunks;
}

// ──────────────────────────────────────────────
// MAIN PARSE ORCHESTRATOR
// ──────────────────────────────────────────────
function parseWorkbook(workbook) {
  var sheetNames = workbook.SheetNames;
  var sectors = [];
  var allResources = [];
  var emuServices = [];
  var preparednessLibrary = [];
  var recognized = [];
  var unrecognized = [];
  var missingExpected = [];

  var foundSheetIds = {};
  for (var i = 0; i < sheetNames.length; i++) {
    var name = sheetNames[i];
    var config = SHEET_MAP[name];
    if (config) {
      recognized.push({ sheetName: name, config: config });
      foundSheetIds[config.id] = true;
    } else {
      unrecognized.push(name);
    }
  }

  var expectedIds = {};
  for (var key in SHEET_MAP) {
    var id = SHEET_MAP[key].id;
    if (id !== '_emu' && id !== '_preparedness') expectedIds[id] = key;
  }
  for (var eid in expectedIds) {
    if (!foundSheetIds[eid]) missingExpected.push(expectedIds[eid]);
  }

  for (var r = 0; r < recognized.length; r++) {
    var entry = recognized[r];
    var sheet = workbook.Sheets[entry.sheetName];
    var result;

    switch (entry.config.format) {
      case 'rmie':       result = parseRMiESheet(sheet, entry.config.id); break;
      case 'pcie':       result = parsePCiESheet(sheet, entry.config.id); break;
      case 'response_mgmt': result = parseResponseMgmtSheet(sheet, entry.config.id); break;
      case 'integra':    result = parseIntegraSheet(sheet, entry.config.id); break;
      case 'emu':        emuServices = parseEmUSheet(sheet); continue;
      case 'preparedness': preparednessLibrary = parsePreparednessSheet(sheet); continue;
      default:           result = parseStandardSheet(sheet, entry.config.id); break;
    }

    sectors.push({
      id: entry.config.id,
      name: entry.config.name,
      contacts: result.contacts,
      tasks: result.tasks
    });
    allResources = allResources.concat(result.resources);
  }

  var mergedSectors = mergeSectors(sectors);
  deduplicateResources(mergedSectors);

  var resourceIndex = [];
  var seenUrls = {};
  for (var ri = 0; ri < allResources.length; ri++) {
    var res = allResources[ri];
    var normUrl = (res.url || '').replace(/\/+$/, '').toLowerCase();
    if (normUrl && !seenUrls[normUrl]) {
      seenUrls[normUrl] = true;
      resourceIndex.push({ name: res.name, url: res.url, sector: res.sector, task: res.task });
    }
  }

  var searchChunks = generateSearchChunks(mergedSectors, []);

  var totalTasks = 0;
  var totalResources = 0;
  var resourcesWithUrl = 0;
  for (var si = 0; si < mergedSectors.length; si++) {
    totalTasks += mergedSectors[si].tasks.length;
    for (var ti = 0; ti < mergedSectors[si].tasks.length; ti++) {
      var t = mergedSectors[si].tasks[ti];
      totalResources += t.resources.length;
      for (var ri2 = 0; ri2 < t.resources.length; ri2++) {
        if (t.resources[ri2].url) resourcesWithUrl++;
      }
      for (var si2 = 0; si2 < t.subtasks.length; si2++) {
        totalResources += t.subtasks[si2].resources.length;
        for (var ri3 = 0; ri3 < t.subtasks[si2].resources.length; ri3++) {
          if (t.subtasks[si2].resources[ri3].url) resourcesWithUrl++;
        }
      }
    }
  }

  var processData = {
    metadata: {
      buildDate: new Date().toISOString(),
      totalSectors: mergedSectors.length,
      totalTasks: totalTasks,
      totalResources: totalResources,
      source: 'admin-upload'
    },
    phases: PHASES,
    sectors: mergedSectors,
    guidelines: [],
    annexes: [],
    emuServices: emuServices,
    preparednessLibrary: preparednessLibrary
  };

  return {
    processData: processData,
    resourceIndex: resourceIndex,
    searchChunks: searchChunks,
    stats: {
      totalSectors: mergedSectors.length,
      totalTasks: totalTasks,
      totalResources: totalResources,
      resourcesWithUrl: resourcesWithUrl,
      resourcesWithoutUrl: totalResources - resourcesWithUrl
    },
    recognized: recognized.map(function(e) { return e.sheetName; }),
    unrecognized: unrecognized,
    missingExpected: missingExpected,
    sectorDetails: mergedSectors.map(function(s) {
      var resCount = 0;
      var urlCount = 0;
      for (var ti = 0; ti < s.tasks.length; ti++) {
        resCount += s.tasks[ti].resources.length;
        urlCount += s.tasks[ti].resources.filter(function(r) { return !!r.url; }).length;
        for (var si = 0; si < s.tasks[ti].subtasks.length; si++) {
          resCount += s.tasks[ti].subtasks[si].resources.length;
          urlCount += s.tasks[ti].subtasks[si].resources.filter(function(r) { return !!r.url; }).length;
        }
      }
      return { id: s.id, name: s.name, taskCount: s.tasks.length, resourceCount: resCount, urlCount: urlCount };
    })
  };
}

// ──────────────────────────────────────────────
// DIFF: Compare parsed data with live data
// ──────────────────────────────────────────────
async function fetchLiveData() {
  try {
    var resp = await fetch('https://raw.githubusercontent.com/bobkitchen/IRC-Emergency-Platform/main/apps/navigator/src/data/process-data.json');
    if (!resp.ok) return null;
    return await resp.json();
  } catch (e) {
    console.warn('Could not fetch live data for diff:', e);
    return null;
  }
}

function computeDiff(newData, liveData) {
  if (!liveData || !liveData.sectors) return null;

  var diff = { sectors: [] };
  var liveMap = {};
  for (var i = 0; i < liveData.sectors.length; i++) {
    liveMap[liveData.sectors[i].id] = liveData.sectors[i];
  }

  var newMap = {};
  for (var j = 0; j < newData.sectors.length; j++) {
    var ns = newData.sectors[j];
    newMap[ns.id] = ns;
    var ls = liveMap[ns.id];
    if (ls) {
      var liveResCount = 0;
      for (var lt = 0; lt < ls.tasks.length; lt++) {
        liveResCount += ls.tasks[lt].resources.length;
        for (var ls2 = 0; ls2 < ls.tasks[lt].subtasks.length; ls2++) {
          liveResCount += ls.tasks[lt].subtasks[ls2].resources.length;
        }
      }
      var newResCount = 0;
      for (var nt = 0; nt < ns.tasks.length; nt++) {
        newResCount += ns.tasks[nt].resources.length;
        for (var ns2 = 0; ns2 < ns.tasks[nt].subtasks.length; ns2++) {
          newResCount += ns.tasks[nt].subtasks[ns2].resources.length;
        }
      }
      diff.sectors.push({
        name: ns.name,
        status: 'changed',
        tasksBefore: ls.tasks.length,
        tasksAfter: ns.tasks.length,
        resourcesBefore: liveResCount,
        resourcesAfter: newResCount
      });
    } else {
      diff.sectors.push({ name: ns.name, status: 'added' });
    }
  }

  for (var lid in liveMap) {
    if (!newMap[lid]) {
      diff.sectors.push({ name: liveMap[lid].name, status: 'removed' });
    }
  }

  return diff;
}

// ──────────────────────────────────────────────
// PREVIEW RENDERING
// ──────────────────────────────────────────────
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function statCard(label, value) {
  return '<div style="background:var(--white); border:1px solid var(--gray-e9); border-radius:8px; padding:16px; text-align:center;">' +
    '<div style="font-size:1.5rem; font-weight:700;">' + value + '</div>' +
    '<div style="font-size:0.75rem; color:var(--muted); text-transform:uppercase; letter-spacing:0.05em;">' + label + '</div></div>';
}

function renderPreview(parseResult, diff) {
  var stats = parseResult.stats;
  var html = '';

  // Header stats
  html += '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; margin-bottom:24px;">';
  html += statCard('Sectors', stats.totalSectors);
  html += statCard('Tasks', stats.totalTasks);
  html += statCard('Resources (URL)', stats.resourcesWithUrl);
  html += statCard('Resources (no URL)', stats.resourcesWithoutUrl);
  html += '</div>';

  // Unrecognized sheets
  if (parseResult.unrecognized.length > 0) {
    html += '<div class="settings-card" style="border-left:4px solid var(--irc-yellow); margin-bottom:16px;">';
    html += '<h4 style="margin-bottom:8px;">Unrecognized Sheets</h4>';
    html += '<p style="font-size:0.8125rem; color:var(--muted); margin-bottom:12px;">These sheets were found but don\'t match any known sector format:</p>';
    for (var u = 0; u < parseResult.unrecognized.length; u++) {
      html += '<div style="padding:8px 12px; background:var(--light-gray); border-radius:6px; margin-bottom:6px; font-size:0.875rem;">' +
        '<strong>' + escapeHtml(parseResult.unrecognized[u]) + '</strong>' +
        ' — <em>skipped (not a recognized sector)</em></div>';
    }
    html += '</div>';
  }

  // Missing expected sheets
  if (parseResult.missingExpected.length > 0) {
    html += '<div class="settings-card" style="border-left:4px solid var(--stance-orange); margin-bottom:16px;">';
    html += '<h4 style="margin-bottom:8px;">Missing Expected Sheets</h4>';
    html += '<p style="font-size:0.8125rem; color:var(--muted); margin-bottom:12px;">These known sectors were not found in the uploaded XLSM:</p>';
    for (var m = 0; m < parseResult.missingExpected.length; m++) {
      html += '<div style="padding:8px 12px; background:#FFF5E5; border-radius:6px; margin-bottom:6px; font-size:0.875rem;">' +
        escapeHtml(parseResult.missingExpected[m]) + '</div>';
    }
    html += '</div>';
  }

  // Diff summary
  if (diff) {
    html += '<div class="settings-card" style="margin-bottom:16px;">';
    html += '<h4 style="margin-bottom:12px;">Changes vs Live Data</h4>';
    for (var d = 0; d < diff.sectors.length; d++) {
      var ds = diff.sectors[d];
      if (ds.status === 'added') {
        html += '<div style="padding:6px 0; font-size:0.875rem;"><span style="color:green; font-weight:600;">+ Added:</span> ' + escapeHtml(ds.name) + '</div>';
      } else if (ds.status === 'removed') {
        html += '<div style="padding:6px 0; font-size:0.875rem;"><span style="color:var(--stance-red); font-weight:600;">− Removed:</span> ' + escapeHtml(ds.name) + '</div>';
      } else {
        var taskDelta = ds.tasksAfter - ds.tasksBefore;
        var resDelta = ds.resourcesAfter - ds.resourcesBefore;
        var taskStr = ds.tasksBefore + ' → ' + ds.tasksAfter + ' tasks' + (taskDelta !== 0 ? ' (' + (taskDelta > 0 ? '+' : '') + taskDelta + ')' : '');
        var resStr = ds.resourcesBefore + ' → ' + ds.resourcesAfter + ' resources' + (resDelta !== 0 ? ' (' + (resDelta > 0 ? '+' : '') + resDelta + ')' : '');
        html += '<div style="padding:6px 0; font-size:0.875rem;"><strong>' + escapeHtml(ds.name) + ':</strong> ' + taskStr + ', ' + resStr + '</div>';
      }
    }
    html += '</div>';
  }

  // Per-sector cards
  html += '<h4 style="margin-bottom:12px;">Sector Breakdown</h4>';
  for (var s = 0; s < parseResult.sectorDetails.length; s++) {
    var sec = parseResult.sectorDetails[s];
    html += '<details class="settings-card" style="margin-bottom:8px; cursor:pointer;">';
    html += '<summary style="font-weight:600;">' + escapeHtml(sec.name) +
      ' <span style="font-weight:400; color:var(--muted);">— ' + sec.taskCount + ' tasks, ' + sec.resourceCount + ' resources (' + sec.urlCount + ' with URL)</span></summary>';
    var sectorObj = null;
    for (var si = 0; si < parseResult.processData.sectors.length; si++) {
      if (parseResult.processData.sectors[si].id === sec.id) { sectorObj = parseResult.processData.sectors[si]; break; }
    }
    if (sectorObj) {
      html += '<div style="padding:12px 0 0;">';
      var limit = Math.min(5, sectorObj.tasks.length);
      for (var ti = 0; ti < limit; ti++) {
        html += '<div style="padding:4px 0; font-size:0.8125rem;">' + escapeHtml(sectorObj.tasks[ti].id) + ' — ' + escapeHtml(sectorObj.tasks[ti].title) + '</div>';
      }
      if (sectorObj.tasks.length > 5) {
        html += '<div style="padding:4px 0; font-size:0.8125rem; color:var(--muted);">...and ' + (sectorObj.tasks.length - 5) + ' more</div>';
      }
      html += '</div>';
    }
    html += '</details>';
  }

  // Action buttons
  html += '<div style="display:flex; gap:12px; margin-top:24px; flex-wrap:wrap;">';
  html += '<button id="nav-confirm-btn" class="btn-primary" style="padding:10px 24px; border:none; border-radius:8px; font-weight:700; cursor:pointer; font-family:var(--font-family);">Confirm & Deploy</button>';
  html += '<button id="nav-download-btn" class="btn-secondary" style="padding:10px 24px; border:1px solid var(--gray-e9); border-radius:8px; cursor:pointer; font-family:var(--font-family);">Download JSON</button>';
  html += '<button id="nav-cancel-btn" class="btn-secondary" style="padding:10px 24px; border:1px solid var(--gray-e9); border-radius:8px; cursor:pointer; font-family:var(--font-family);">Cancel</button>';
  html += '</div>';

  return html;
}

// ──────────────────────────────────────────────
// GITHUB COMMIT via Git Data API
// ──────────────────────────────────────────────
var GITHUB_OWNER = 'bobkitchen';
var GITHUB_REPO = 'IRC-Emergency-Platform';
var GITHUB_BRANCH = 'main';
var DATA_PATH_PREFIX = 'apps/navigator/src/data/';

async function commitToGitHub(processData, resourceIndex, searchChunks) {
  // ENCRYPTED_PAT and adminPassword are globals from index.html
  var pat = await CryptoUtils.decryptWithPassword(ENCRYPTED_PAT, adminPassword);
  if (!pat) throw new Error('Failed to decrypt GitHub token. Was the correct password entered?');

  var headers = {
    'Authorization': 'token ' + pat,
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json'
  };
  var apiBase = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO;

  // Step 1: Get current branch SHA
  var refResp = await fetch(apiBase + '/git/ref/heads/' + GITHUB_BRANCH, { headers: headers });
  if (!refResp.ok) throw new Error('Failed to get branch ref: ' + refResp.status);
  var refData = await refResp.json();
  var latestSha = refData.object.sha;

  // Step 2: Get the tree SHA
  var commitResp = await fetch(apiBase + '/git/commits/' + latestSha, { headers: headers });
  if (!commitResp.ok) throw new Error('Failed to get commit: ' + commitResp.status);
  var commitData = await commitResp.json();
  var treeSha = commitData.tree.sha;

  // Step 3: Create blobs for all three files
  var files = [
    { path: DATA_PATH_PREFIX + 'process-data.json', content: JSON.stringify(processData, null, 2) },
    { path: DATA_PATH_PREFIX + 'resource-index.json', content: JSON.stringify(resourceIndex, null, 2) },
    { path: DATA_PATH_PREFIX + 'search-chunks.json', content: JSON.stringify(searchChunks, null, 2) }
  ];

  var treeEntries = [];
  for (var i = 0; i < files.length; i++) {
    var blobResp = await fetch(apiBase + '/git/blobs', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ content: files[i].content, encoding: 'utf-8' })
    });
    if (!blobResp.ok) throw new Error('Failed to create blob for ' + files[i].path + ': ' + blobResp.status);
    var blobData = await blobResp.json();
    treeEntries.push({ path: files[i].path, mode: '100644', type: 'blob', sha: blobData.sha });
  }

  // Step 4: Create new tree
  var treeResp = await fetch(apiBase + '/git/trees', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ base_tree: treeSha, tree: treeEntries })
  });
  if (!treeResp.ok) throw new Error('Failed to create tree: ' + treeResp.status);
  var treeData = await treeResp.json();

  // Step 5: Create commit
  var today = new Date().toISOString().slice(0, 10);
  var newCommitResp = await fetch(apiBase + '/git/commits', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      message: 'data: update Navigator tasks from Roadmap XLSM (' + today + ')',
      tree: treeData.sha,
      parents: [latestSha]
    })
  });
  if (!newCommitResp.ok) throw new Error('Failed to create commit: ' + newCommitResp.status);
  var newCommitData = await newCommitResp.json();

  // Step 6: Update branch ref
  var updateResp = await fetch(apiBase + '/git/refs/heads/' + GITHUB_BRANCH, {
    method: 'PATCH',
    headers: headers,
    body: JSON.stringify({ sha: newCommitData.sha })
  });
  if (!updateResp.ok) throw new Error('Failed to update branch: ' + updateResp.status);

  return {
    sha: newCommitData.sha,
    url: 'https://github.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/commit/' + newCommitData.sha
  };
}

// ──────────────────────────────────────────────
// DOWNLOAD JSON FILES
// ──────────────────────────────────────────────
function downloadJSON(data, filename) {
  var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ──────────────────────────────────────────────
// MAIN ENTRY POINT
// ──────────────────────────────────────────────
var currentParseResult = null;

async function handleFile(file) {
  var statusEl = document.getElementById('nav-parsing-status');
  var parseLabel = document.getElementById('nav-parse-label');
  var parseDot = document.getElementById('nav-parse-dot');
  var previewEl = document.getElementById('nav-preview');
  var uploadZone = document.getElementById('nav-upload-zone');

  statusEl.style.display = '';
  previewEl.style.display = 'none';
  parseLabel.textContent = 'Reading spreadsheet...';

  try {
    var arrayBuffer = await file.arrayBuffer();
    parseLabel.textContent = 'Parsing sheets...';

    var workbook = XLSX.read(arrayBuffer, { type: 'array', cellStyles: true });
    var result = parseWorkbook(workbook);
    currentParseResult = result;

    parseLabel.textContent = 'Fetching live data for comparison...';
    var liveData = await fetchLiveData();

    // Carry forward non-sector data from live if absent in XLSM
    if (liveData) {
      if (result.processData.guidelines.length === 0 && liveData.guidelines) {
        result.processData.guidelines = liveData.guidelines;
      }
      if (result.processData.annexes.length === 0 && liveData.annexes) {
        result.processData.annexes = liveData.annexes;
      }
      if (result.processData.emuServices.length === 0 && liveData.emuServices) {
        result.processData.emuServices = liveData.emuServices;
      }
      if (result.processData.preparednessLibrary.length === 0 && liveData.preparednessLibrary) {
        result.processData.preparednessLibrary = liveData.preparednessLibrary;
      }
    }

    var diff = liveData ? computeDiff(result.processData, liveData) : null;

    parseDot.className = 'status-dot green';
    parseLabel.textContent = 'Parsed ' + result.stats.totalTasks + ' tasks across ' + result.stats.totalSectors + ' sectors';
    previewEl.innerHTML = renderPreview(result, diff);
    previewEl.style.display = '';
    uploadZone.style.display = 'none';

    document.getElementById('nav-confirm-btn').addEventListener('click', handleConfirm);
    document.getElementById('nav-download-btn').addEventListener('click', handleDownload);
    document.getElementById('nav-cancel-btn').addEventListener('click', handleCancel);

  } catch (err) {
    parseDot.className = 'status-dot red';
    parseLabel.textContent = 'Error: ' + err.message;
    console.error('Parse error:', err);
  }
}

async function handleConfirm() {
  if (!currentParseResult) return;
  var btn = document.getElementById('nav-confirm-btn');
  btn.disabled = true;
  btn.textContent = 'Deploying...';

  try {
    var result = await commitToGitHub(
      currentParseResult.processData,
      currentParseResult.resourceIndex,
      currentParseResult.searchChunks
    );

    btn.textContent = 'Deployed!';
    btn.style.background = '#4CAF50';
    btn.style.color = 'white';

    var successHtml = '<div class="settings-card" style="border-left:4px solid #4CAF50; margin-top:16px;">' +
      '<h4 style="color:#4CAF50;">Successfully Deployed</h4>' +
      '<p style="font-size:0.875rem; margin-top:8px;">Commit: <a href="' + result.url + '" target="_blank" style="color:var(--irc-yellow);">' + result.sha.substring(0, 7) + '</a></p>' +
      '<p style="font-size:0.8125rem; color:var(--muted); margin-top:4px;">CI will now rebuild and redeploy the Navigator. This usually takes 1-2 minutes.</p>' +
      '<p style="font-size:0.8125rem; margin-top:8px;"><a href="https://github.com/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/actions" target="_blank" style="color:var(--irc-yellow);">View GitHub Actions</a></p>' +
      '</div>';
    document.getElementById('nav-preview').insertAdjacentHTML('beforeend', successHtml);

  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Retry Deploy';
    btn.style.background = 'var(--stance-red)';
    btn.style.color = 'white';

    var errorHtml = '<div class="settings-card" style="border-left:4px solid var(--stance-red); margin-top:16px;">' +
      '<h4 style="color:var(--stance-red);">Deploy Failed</h4>' +
      '<p style="font-size:0.875rem; margin-top:8px;">' + escapeHtml(err.message) + '</p>' +
      '<p style="font-size:0.8125rem; color:var(--muted); margin-top:4px;">You can download the JSON files and commit them manually.</p>' +
      '</div>';
    document.getElementById('nav-preview').insertAdjacentHTML('beforeend', errorHtml);
  }
}

function handleDownload() {
  if (!currentParseResult) return;
  downloadJSON(currentParseResult.processData, 'process-data.json');
  downloadJSON(currentParseResult.resourceIndex, 'resource-index.json');
  downloadJSON(currentParseResult.searchChunks, 'search-chunks.json');
}

function handleCancel() {
  currentParseResult = null;
  document.getElementById('nav-preview').style.display = 'none';
  document.getElementById('nav-preview').innerHTML = '';
  document.getElementById('nav-parsing-status').style.display = 'none';
  document.getElementById('nav-upload-zone').style.display = '';
}

// Expose to global scope
window.NavigatorUpload = { handleFile: handleFile, parseWorkbook: parseWorkbook };
