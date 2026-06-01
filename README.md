# Quill

A small learning app for at-home practice — worksheets, scratch pads, and short study notes. Built for families, loosely aligned with Ontario Grade 5 math.

**Live app:** [quill-app.fly.dev](https://quill-app.fly.dev)

## What it does

- **Students** sign in, browse worksheets by subject, work through questions (with optional scratch pads), and submit for instant scoring.
- **Admins** (parents/tutors) manage students, preview worksheets, and review results.
- **Learn hub** — markdown study notes linked to worksheet topics (place value, fractions, money, graphs, and more).

## Project layout

```
quill/
├── backend/          FastAPI API, SQLite, worksheet JSON, learn content
│   ├── data/
│   │   ├── worksheets/   One JSON file per worksheet (e.g. questions_39.json)
│   │   └── learn/        Markdown notes + manifest.json per subject
│   ├── main.py
│   └── seed_worksheets.py
├── frontend/         React + Vite + Tailwind
└── scripts/          Cron helper for merging worksheets in production
```

## Tech stack

| Layer    | Stack                          |
|----------|--------------------------------|
| Frontend | React 19, Vite, Tailwind CSS   |
| Backend  | FastAPI, SQLite, JWT auth      |
| Deploy   | Fly.io (frontend + backend)    |

## Local development

**Backend** (port 8000):

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

**Frontend** (port 5173):

```bash
cd frontend
npm install
npm run dev
```

The frontend reads `VITE_API_URL` from `.env.development` (defaults to `http://localhost:8000`).

On first run, the backend seeds worksheets from JSON if the database is empty.

## Adding a worksheet

1. Create `backend/data/worksheets/questions_N.json`:

```json
{
  "title": "Math — My new worksheet",
  "subject": "math",
  "learn_subject": "math",
  "learn_section": "money-basics",
  "scratchpad": true,
  "created_at": "2026-06-01T12:00:00Z",
  "questions": [
    {
      "id": "q1",
      "type": "multiple_choice",
      "prompt": "Your question here?",
      "choices": ["A", "B", "C", "D"],
      "answer": "B",
      "hint": false
    }
  ]
}
```

2. Merge into your local DB:

```bash
cd backend
python seed_worksheets.py --merge
```

3. For production after deploy, merge via SSH or cron:

```bash
# SSH
fly ssh console -a quill-backend -C "/app/.venv/bin/python /app/seed_worksheets.py --merge"

# Or cron endpoint (requires QUILL_CRON_SECRET)
BACKEND_URL=https://quill-backend.fly.dev QUILL_CRON_SECRET=... ./scripts/cron_merge_worksheets.sh
```

Reading passages are supported too — see existing worksheets with a `"passages"` array for examples.

## Deployment

Both apps deploy independently to Fly.io:

```bash
cd backend && fly deploy
cd frontend && fly deploy
```

The backend persists data on a Fly volume at `/data/app.db`. New worksheet JSON ships with each backend deploy but must be **merged** into SQLite (see above) unless the database is empty.

## License

Personal / educational use. Feel free to fork and adapt for your own family or classroom.
