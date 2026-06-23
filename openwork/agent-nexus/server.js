import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite database
const db = new Database('../nexus.db');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    systemPrompt TEXT,
    model TEXT,
    temperature REAL,
    maxTokens INTEGER,
    apiEndpoint TEXT,
    session_id TEXT
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    text TEXT NOT NULL,
    schedule_time TEXT,
    active BOOLEAN DEFAULT 1,
    FOREIGN KEY (agent_id) REFERENCES agents (id) ON DELETE CASCADE
  );
`);

// Migrate: add session_id column if it doesn't exist
try {
  db.exec(`ALTER TABLE agents ADD COLUMN session_id TEXT`);
} catch (_) { /* column already exists */ }

// API Routes
app.get('/api/agents', (req, res) => {
  const agents = db.prepare('SELECT * FROM agents').all();
  res.json(agents);
});

app.post('/api/agents', (req, res) => {
  const { id, name, role, type, description, systemPrompt, model, temperature, maxTokens, apiEndpoint } = req.body;
  try {
    db.prepare('INSERT INTO agents (id, name, role, type, description, systemPrompt, model, temperature, maxTokens, apiEndpoint) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, name, role, type, description, systemPrompt, model, temperature, maxTokens, apiEndpoint);
    res.status(201).json(req.body);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/agents/:id', (req, res) => {
  const { name, role, type, description, systemPrompt, model, temperature, maxTokens, apiEndpoint } = req.body;
  try {
    const result = db.prepare('UPDATE agents SET name = ?, role = ?, type = ?, description = ?, systemPrompt = ?, model = ?, temperature = ?, maxTokens = ?, apiEndpoint = ? WHERE id = ?')
      .run(name, role, type, description, systemPrompt, model, temperature, maxTokens, apiEndpoint, req.params.id);
      
    if (result.changes > 0) {
      res.json({ id: req.params.id, name, role, type, description });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/agents/:id/session', (req, res) => {
  const { session_id } = req.body;
  try {
    const result = db.prepare('UPDATE agents SET session_id = ? WHERE id = ?')
      .run(session_id, req.params.id);
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/agents/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM agents WHERE id = ?').run(req.params.id);
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Agent not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Tasks API Routes
app.get('/api/agents/:agentId/tasks', (req, res) => {
  try {
    const tasks = db.prepare('SELECT * FROM tasks WHERE agent_id = ?').all(req.params.agentId);
    // Convert sqlite 1/0 to boolean for frontend
    const formattedTasks = tasks.map(t => ({...t, active: t.active === 1}));
    res.json(formattedTasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/agents/:agentId/tasks', (req, res) => {
  const { text, schedule_time, active } = req.body;
  try {
    const result = db.prepare('INSERT INTO tasks (agent_id, text, schedule_time, active) VALUES (?, ?, ?, ?)')
      .run(req.params.agentId, text, schedule_time || null, active === false ? 0 : 1);
    
    res.status(201).json({
      id: result.lastInsertRowid,
      agent_id: req.params.agentId,
      text,
      schedule_time,
      active: active !== false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id/toggle', (req, res) => {
  const { active } = req.body;
  try {
    const result = db.prepare('UPDATE tasks SET active = ? WHERE id = ?')
      .run(active ? 1 : 0, req.params.id);
    
    if (result.changes > 0) {
      res.json({ success: true, active });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    if (result.changes > 0) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Task not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Backend server running at http://localhost:${port}`);
});
