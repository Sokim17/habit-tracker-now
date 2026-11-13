import sqlite3
from contextlib import contextmanager
from datetime import date
from typing import Literal

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
            name TEXT NOT NULL,
            position INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS completions (
            habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
            day TEXT NOT NULL,
            PRIMARY KEY (habit_id, day)
        );
        """
    )
    columns = {row["name"] for row in c.execute("PRAGMA table_info(habits)")}
    if "position" not in columns:
        c.execute(
            "ALTER TABLE habits ADD COLUMN position INTEGER NOT NULL DEFAULT 0"
        )
        c.execute("UPDATE habits SET position = id")


class HabitIn(BaseModel):
    name: str


class HabitMoveIn(BaseModel):
    direction: Literal["up", "down"]


@app.get("/habits")
def list_habits():
    with db() as c:
        habits = [
            dict(r)
            for r in c.execute(
                "SELECT id, name FROM habits ORDER BY position, id"
            )
        ]
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
        position = c.execute(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM habits"
        ).fetchone()[0]
        cur = c.execute(
            "INSERT INTO habits (name, position) VALUES (?, ?)", (name, position)
        )
        return {"id": cur.lastrowid, "name": name, "days": []}


@app.put("/habits/{habit_id}")
def update_habit(habit_id: int, body: HabitIn):
    name = body.name.strip()
    if not name:
        raise HTTPException(400, "Name required")
    with db() as c:
        cur = c.execute("UPDATE habits SET name = ? WHERE id = ?", (name, habit_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "Habit not found")
        rows = c.execute(
            "SELECT day FROM completions WHERE habit_id = ?", (habit_id,)
        ).fetchall()
    return {"id": habit_id, "name": name, "days": sorted(r["day"] for r in rows)}


@app.post("/habits/{habit_id}/move")
def move_habit(habit_id: int, body: HabitMoveIn):
    with db() as c:
        habits = c.execute(
            "SELECT id, position FROM habits ORDER BY position, id"
        ).fetchall()
        current_index = next(
            (index for index, habit in enumerate(habits) if habit["id"] == habit_id),
            None,
        )
        if current_index is None:
            raise HTTPException(404, "Habit not found")

        adjacent_index = current_index + (-1 if body.direction == "up" else 1)
        if not 0 <= adjacent_index < len(habits):
            return {"id": habit_id, "moved": False}

        current = habits[current_index]
        adjacent = habits[adjacent_index]
        c.execute(
            "UPDATE habits SET position = ? WHERE id = ?",
            (adjacent["position"], habit_id),
        )
        c.execute(
            "UPDATE habits SET position = ? WHERE id = ?",
            (current["position"], adjacent["id"]),
        )
    return {"id": habit_id, "moved": True}


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