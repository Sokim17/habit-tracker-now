import sqlite3
from contextlib import contextmanager
from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DB = "habits.db"

app = FastAPI(title="Habit Tracker API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@contextmanager
def db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


with db() as c:
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS completions (
            habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
            day TEXT NOT NULL,
            PRIMARY KEY (habit_id, day)
        );
        """
    )


class HabitIn(BaseModel):
    name: str


@app.get("/habits")
def list_habits():
    with db() as c:
        habits = [dict(r) for r in c.execute("SELECT id, name FROM habits ORDER BY id")]
        for h in habits:
            rows = c.execute(
                "SELECT day FROM completions WHERE habit_id = ?", (h["id"],)
            ).fetchall()
            h["days"] = sorted(r["day"] for r in rows)
    return habits


@app.post("/habits", status_code=201)
def create_habit(body: HabitIn):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    with db() as c:
        cur = c.execute("INSERT INTO habits (name) VALUES (?)", (name,))
        return {"id": cur.lastrowid, "name": name, "days": []}


@app.delete("/habits/{habit_id}", status_code=204)
def delete_habit(habit_id: int):
    with db() as c:
        c.execute("DELETE FROM habits WHERE id = ?", (habit_id,))


@app.post("/habits/{habit_id}/toggle")
def toggle(habit_id: int, day: str | None = None):
    day = day or date.today().isoformat()
    with db() as c:
        exists = c.execute(
            "SELECT 1 FROM completions WHERE habit_id = ? AND day = ?", (habit_id, day)
        ).fetchone()
        if exists:
            c.execute(
                "DELETE FROM completions WHERE habit_id = ? AND day = ?", (habit_id, day)
            )
        else:
            c.execute(
                "INSERT INTO completions (habit_id, day) VALUES (?, ?)", (habit_id, day)
            )
    return {"habit_id": habit_id, "day": day, "done": not exists}