import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, '../../data/event_registrations.json');

const router = Router();

function getRegistrations(): any[] {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, '[]', 'utf8');
      return [];
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    console.error('[Event Registrations] Error reading file:', err);
    return [];
  }
}

function saveRegistrations(data: any[]): void {
  try {
    const dir = path.dirname(DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[Event Registrations] Error writing file:', err);
  }
}

// 1. Submit Event Participation (Public, Free, Zero Supabase Required)
router.post('/participate', (req, res) => {
  try {
    const { event_id, event_title, name, email, phone, college, branch, roll_number } = req.body;

    if (!event_id || !name?.trim() || !email?.trim()) {
      return res.status(400).json({ error: 'Name, email, and event ID are required.' });
    }

    const list = getRegistrations();

    // Check duplicate email on same event
    const normalizedEmail = email.trim().toLowerCase();
    const existing = list.find(
      (r) => r.event_id === event_id && r.email?.toLowerCase() === normalizedEmail
    );

    if (existing) {
      return res.status(400).json({
        error: 'You have already registered your interest for this event with this email.',
      });
    }

    const newRecord = {
      id: 'reg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      event_id,
      event_title: event_title || 'AICONEKT Event',
      full_name: name.trim(),
      email: normalizedEmail,
      phone: phone?.trim() || null,
      college: college?.trim() || 'N/A',
      branch: branch?.trim() || 'N/A',
      roll_number: roll_number?.trim() || 'N/A',
      created_at: new Date().toISOString(),
      status: 'registered',
    };

    list.unshift(newRecord);
    saveRegistrations(list);

    res.status(201).json({ success: true, participant: newRecord });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to record participation.' });
  }
});

// 2. Fetch Registrations (Public count / CEO Dashboard view)
router.get('/participants', (req, res) => {
  try {
    const eventId = req.query.event_id as string;
    const list = getRegistrations();
    if (eventId) {
      const filtered = list.filter((r) => r.event_id === eventId);
      return res.json(filtered);
    }
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch participants.' });
  }
});

// 3. Remove Participant (CEO Dashboard Action)
router.delete('/participants/:id', (req, res) => {
  try {
    const { id } = req.params;
    let list = getRegistrations();
    list = list.filter((r) => r.id !== id);
    saveRegistrations(list);
    res.json({ success: true, message: 'Participant removed.' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to delete participant.' });
  }
});

export default router;
