const { Project, FinanceItem } = require('../models');
const {
  financeStoredName,
  saveFinanceFile,
  removeFinanceFile,
  financeFilePath,
  financeFileExists,
} = require('../utils/financeFiles');

const KINDS = ['cost', 'contract', 'budget'];

function toPublicFinanceItem(item) {
  return {
    id: item.id,
    projectId: item.projectId,
    kind: item.kind,
    title: item.title,
    amount: Number(item.amount),
    notes: item.notes,
    fileName: item.fileName,
    mimeType: item.mimeType,
    hasFile: Boolean(item.storedName),
    createdBy: item.createdBy,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function parseAmount(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

async function loadProject(req, res) {
  const project = await Project.findByPk(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return project;
}

async function loadItem(req, res, project) {
  const item = await FinanceItem.findOne({
    where: { id: req.params.itemId, projectId: project.id },
  });
  if (!item) {
    res.status(404).json({ error: 'Finance item not found' });
    return null;
  }
  return item;
}

async function list(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const items = await FinanceItem.findAll({
    where: { projectId: project.id },
    order: [['id', 'ASC']],
  });
  return res.json(items.map(toPublicFinanceItem));
}

async function create(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const { kind, title, notes } = req.body;
  if (typeof title !== 'string' || !title.trim()) {
    return res.status(400).json({ error: 'Invalid title' });
  }
  if (!KINDS.includes(kind)) {
    return res.status(400).json({ error: 'Invalid kind' });
  }
  const amount = parseAmount(req.body.amount);
  if (amount === null) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  const item = await FinanceItem.create({
    projectId: project.id,
    kind,
    title,
    amount,
    notes: notes || null,
    createdBy: req.user.id,
  });
  if (req.file) {
    const pendingStoredName = financeStoredName(item.id, req.file.originalname);
    try {
      const saved = saveFinanceFile(item.id, req.file, pendingStoredName);
      item.fileName = saved.fileName;
      item.storedName = saved.storedName;
      item.mimeType = saved.mimeType;
      await item.save();
    } catch (error) {
      removeFinanceFile(pendingStoredName);
      await item.destroy();
      throw error;
    }
  }
  return res.status(201).json(toPublicFinanceItem(item));
}

async function update(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const item = await loadItem(req, res, project);
  if (!item) return;
  let oldStoredName;
  let newStoredName;
  if (
    req.body.title !== undefined &&
    (typeof req.body.title !== 'string' || !req.body.title.trim())
  ) {
    return res.status(400).json({ error: 'Invalid title' });
  }
  if (req.body.kind !== undefined) {
    if (!KINDS.includes(req.body.kind)) {
      return res.status(400).json({ error: 'Invalid kind' });
    }
    item.kind = req.body.kind;
  }
  if (req.body.title !== undefined) item.title = req.body.title;
  if (req.body.notes !== undefined) item.notes = req.body.notes;
  if (req.body.amount !== undefined) {
    const amount = parseAmount(req.body.amount);
    if (amount === null) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    item.amount = amount;
  }
  if (req.file) {
    oldStoredName = item.storedName;
    const pendingStoredName = financeStoredName(item.id, req.file.originalname);
    let saved;
    try {
      saved = saveFinanceFile(item.id, req.file, pendingStoredName);
    } catch (error) {
      removeFinanceFile(pendingStoredName);
      throw error;
    }
    newStoredName = saved.storedName;
    item.fileName = saved.fileName;
    item.storedName = saved.storedName;
    item.mimeType = saved.mimeType;
  }
  try {
    await item.save();
  } catch (error) {
    removeFinanceFile(newStoredName);
    throw error;
  }
  if (oldStoredName !== newStoredName) {
    removeFinanceFile(oldStoredName);
  }
  return res.json(toPublicFinanceItem(item));
}

async function remove(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const item = await loadItem(req, res, project);
  if (!item) return;
  removeFinanceFile(item.storedName);
  await item.destroy();
  return res.status(204).send();
}

async function download(req, res) {
  const project = await loadProject(req, res);
  if (!project) return;
  const item = await loadItem(req, res, project);
  if (!item) return;
  if (!financeFileExists(item.storedName)) {
    return res.status(404).json({ error: 'File not found' });
  }
  return res.download(financeFilePath(item.storedName), item.fileName);
}

module.exports = { list, create, update, remove, download };
