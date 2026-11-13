# Daymark Habit Tracker

Daymark is a simple daily habit tracker. Add, rename, and reorder habits, mark them complete today or plan completions for tomorrow, browse past check-ins in the calendar, and review recent activity and streaks.

## Requirements

- Python 3
- Node.js and npm

## Run locally

### 1. Start the API

Open a terminal in the project root and run:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Keep this terminal open while using the app. The API listens on `http://localhost:8000`.

### 2. Start the frontend

Open a second terminal in the project root:

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The frontend uses `http://localhost:8000` by default. To use a different API URL, set `NEXT_PUBLIC_API_URL` in the frontend environment.

## Using Daymark

- Add a habit with the form under the habit list. Use the pencil button to rename it, the up/down arrows to reorder it, or the trash button to delete it.
- Choose **Today** or **Tomorrow** to record a check-in or plan one ahead.
- Use the calendar in the overview to browse months. Dates with saved check-ins have a dot; select a date to view that day’s tracker and completion history. You can toggle a habit on a past date to correct its record.
- The calendar shows today and tomorrow as the furthest dates ahead. The **Last 7 days** chart remains a rolling view of the current day and six days before it.

## Data storage

The backend uses SQLite. On its first start, it creates the `habits` and `completions` tables and the database file automatically. With the API startup commands above, the file is `backend/habits.db`.

Habits, their order, and completion dates remain saved when you stop and restart the app. Existing databases are updated automatically to store habit order. Keep the database file to preserve your data; deleting it removes your habits and check-in history. For a hosted deployment, store the database on persistent storage so it survives restarts and redeploys.