"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type Habit = { id: number; name: string; days: string[] };

const iso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const daysAgo = (amount: number, from: Date) => {
  const date = new Date(from);
  date.setDate(date.getDate() - amount);
  return date;
};

const dateLabel = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en", options).format(date);

function streak(days: string[], currentDate: Date) {
  const completed = new Set(days);
  let offset = completed.has(iso(daysAgo(0, currentDate))) ? 0 : 1;
  let count = 0;

  while (completed.has(iso(daysAgo(offset, currentDate)))) {
    count++;
    offset++;
  }

  return count;
}

async function ensureSuccess(response: Response) {
  if (response.ok) return;

  let message = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    if (typeof body.detail === "string") message = body.detail;
  } catch {
    // Keep the HTTP status message when the response has no JSON body.
  }
  throw new Error(message);
}

export default function Home() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyHabit, setBusyHabit] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const today = currentDate ? iso(currentDate) : "";

  const loadHabits = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API}/habits`);
      await ensureSuccess(response);
      setHabits(await response.json());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load your habits.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHabits(), 0);
    return () => window.clearTimeout(timer);
  }, [loadHabits]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const updateDateAndSchedule = () => {
      const now = new Date();
      setCurrentDate(now);

      const nextDay = new Date(now);
      nextDay.setHours(24, 0, 0, 100);
      timer = setTimeout(updateDateAndSchedule, nextDay.getTime() - now.getTime());
    };

    timer = setTimeout(updateDateAndSchedule, 0);
    return () => clearTimeout(timer);
  }, []);

  const completedCount = habits.filter((habit) => habit.days.includes(today)).length;
  const progress = habits.length ? Math.round((completedCount / habits.length) * 100) : 0;
  const week = currentDate
    ? Array.from({ length: 7 }, (_, index) => daysAgo(6 - index, currentDate))
    : [];

  const addHabit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || saving) return;

    setSaving(true);
    setError("");
    try {
      const response = await fetch(`${API}/habits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName }),
      });
      await ensureSuccess(response);
      setName("");
      await loadHabits();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add that habit.");
    } finally {
      setSaving(false);
    }
  };

  const toggleHabit = async (id: number) => {
    setBusyHabit(id);
    setError("");
    try {
      const response = await fetch(`${API}/habits/${id}/toggle?day=${today}`, {
        method: "POST",
      });
      await ensureSuccess(response);
      await loadHabits();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update that habit.");
    } finally {
      setBusyHabit(null);
    }
  };

  const removeHabit = async (habit: Habit) => {
    if (!confirm(`Delete “${habit.name}”? Its history will be removed too.`)) return;

    setBusyHabit(habit.id);
    setError("");
    try {
      const response = await fetch(`${API}/habits/${habit.id}`, { method: "DELETE" });
      await ensureSuccess(response);
      await loadHabits();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not delete that habit.");
    } finally {
      setBusyHabit(null);
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="Daymark home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 5v22M5 16h22M8.2 8.2l15.6 15.6m0-15.6L8.2 23.8" />
              <circle cx="16" cy="16" r="4.25" />
            </svg>
          </span>
          <span>daymark</span>
        </Link>
        <div className="topbar-note">
          <span className="status-dot" />
          A little progress, every day
        </div>
      </header>

      <div className="dashboard">
        <section className="main-column" aria-labelledby="page-title">
          <div className="page-intro">
            <p className="eyebrow">
              {currentDate ? dateLabel(currentDate, { weekday: "long", month: "long", day: "numeric" }) : "YOUR DAILY PRACTICE"}
            </p>
            <h1 id="page-title">Make today count.</h1>
            <p className="intro-copy">Small promises to yourself add up. Show up for the next one.</p>
          </div>

          <section className="progress-card" aria-label="Today's progress">
            <div className="progress-copy">
              <div>
                <p className="card-kicker">YOUR DAILY CHECK-IN</p>
                <h2>{habits.length === 0 ? "Start with one small thing" : "You’re building momentum"}</h2>
                <p className="progress-caption">
                  {habits.length === 0
                    ? "Add a habit below to begin your daily rhythm."
                    : `${completedCount} of ${habits.length} ${habits.length === 1 ? "habit" : "habits"} complete today`}
                </p>
              </div>
              <div
                className="progress-ring"
                role="img"
                aria-label={`${progress}% of today's habits complete`}
                style={{ "--progress": `${progress}%` } as CSSProperties}
              >
                <span>{progress}%</span>
              </div>
            </div>
            <div
              className="progress-track"
              role="progressbar"
              aria-label="Today's completion"
              aria-valuenow={completedCount}
              aria-valuemin={0}
              aria-valuemax={habits.length || 1}
            >
              <span style={{ width: `${progress}%` }} />
            </div>
            <div className="progress-footer">
              <span>Keep it gentle. Keep it going.</span>
              <span>{currentDate ? dateLabel(currentDate, { month: "short", day: "numeric" }) : "Today"}</span>
            </div>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => void loadHabits()}>
                Try again
              </button>
            </div>
          )}

          <section className="habits-section" aria-labelledby="habits-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">ONE DAY AT A TIME</p>
                <h2 id="habits-title">Your habits</h2>
              </div>
              <span className="habit-count">
                {habits.length} {habits.length === 1 ? "habit" : "habits"}
              </span>
            </div>

            {loading || !currentDate ? (
              <div className="empty-panel" role="status">Loading your habits…</div>
            ) : habits.length === 0 ? (
              <div className="empty-panel">
                <span className="empty-icon" aria-hidden="true">✳</span>
                <h3>A fresh start, whenever you’re ready.</h3>
                <p>Pick something small enough to do even on a busy day.</p>
              </div>
            ) : (
              <div className="habit-list">
                {habits.map((habit) => {
                  const isComplete = habit.days.includes(today);
                  const currentStreak = streak(habit.days, currentDate);
                  return (
                    <article className={`habit-card${isComplete ? " is-complete" : ""}`} key={habit.id}>
                      <button
                        className="check-button"
                        type="button"
                        onClick={() => void toggleHabit(habit.id)}
                        disabled={busyHabit === habit.id}
                        aria-label={`${isComplete ? "Mark incomplete" : "Mark complete"}: ${habit.name}`}
                        aria-pressed={isComplete}
                      >
                        {isComplete && (
                          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                            <path d="m5 10 3.2 3.2L15.5 6" />
                          </svg>
                        )}
                      </button>
                      <div className="habit-content">
                        <div className="habit-title-row">
                          <h3 className={isComplete ? "completed-title" : ""}>{habit.name}</h3>
                          {currentStreak > 0 && (
                            <span className="streak-pill" title={`${currentStreak} day streak`}>
                              <span aria-hidden="true">✳</span> {currentStreak}
                            </span>
                          )}
                        </div>
                        <div className="week-strip" aria-label="Last seven days">
                          {week.map((date) => {
                            const dayKey = iso(date);
                            const isToday = dayKey === today;
                            const wasDone = habit.days.includes(dayKey);
                            return (
                              <div className="week-day" key={dayKey}>
                                <span className="week-label">{dateLabel(date, { weekday: "narrow" })}</span>
                                <span
                                  className={`week-dot${wasDone ? " done" : ""}${isToday ? " today" : ""}`}
                                  title={`${dateLabel(date, { weekday: "long", month: "short", day: "numeric" })}${wasDone ? " · complete" : ""}`}
                                >
                                  {wasDone ? "✓" : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <button
                        className="delete-button"
                        type="button"
                        onClick={() => void removeHabit(habit)}
                        disabled={busyHabit === habit.id}
                        aria-label={`Delete ${habit.name}`}
                        title="Delete habit"
                      >
                        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                          <path d="M4.5 6h11M8 6V4.5h4V6m2.5 0-.6 9.5H6.1L5.5 6m3 3v4m3-4v4" />
                        </svg>
                      </button>
                    </article>
                  );
                })}
              </div>
            )}

            <form className="add-habit-form" onSubmit={addHabit}>
              <label className="sr-only" htmlFor="habit-name">New habit</label>
              <span className="add-plus" aria-hidden="true">+</span>
              <input
                id="habit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                placeholder="Add a small habit…"
                disabled={saving}
              />
              <button type="submit" disabled={!name.trim() || saving}>
                {saving ? "Adding…" : "Add habit"}
              </button>
            </form>
          </section>
        </section>

        <aside className="side-column" aria-label="Your habit overview">
          <section className="side-card week-card">
            <div className="side-card-heading">
              <div>
                <p className="card-kicker">THE BIG PICTURE</p>
                <h2>Last 7 days</h2>
              </div>
              <span className="week-icon" aria-hidden="true">↗</span>
            </div>
            <p className="side-description">Your check-ins over the last seven days.</p>
            <div className="chart" role="img" aria-label="Habit completion by day for the last seven days">
              {week.map((date) => {
                const dayKey = iso(date);
                const done = habits.filter((habit) => habit.days.includes(dayKey)).length;
                const height = habits.length ? Math.max((done / habits.length) * 100, done ? 12 : 4) : 4;
                return (
                  <div className="chart-column" key={dayKey}>
                    <span className="chart-value">{habits.length ? `${done}/${habits.length}` : "—"}</span>
                    <div className="chart-track">
                      <span className={dayKey === today ? "current" : ""} style={{ height: `${height}%` }} />
                    </div>
                    <span className={`chart-label${dayKey === today ? " today" : ""}`}>
                      {dateLabel(date, { weekday: "narrow" })}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="week-summary">
              <span className="summary-dot" />
              <span>{completedCount} done today</span>
              <span className="summary-divider">·</span>
              <span>{habits.length - completedCount} to go</span>
            </div>
          </section>

          <section className="side-card note-card">
            <span className="note-sparkle" aria-hidden="true">✳</span>
            <p className="card-kicker">A KIND REMINDER</p>
            <h2>Consistency beats intensity.</h2>
            <p>You don’t need a perfect day. Just one small action that makes tomorrow easier.</p>
          </section>

          <p className="privacy-note">
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true">
              <rect x="3.5" y="7.5" width="11" height="8" rx="2" />
              <path d="M6 7.5V5.25a3 3 0 0 1 6 0V7.5" />
            </svg>
            Your progress is yours. No pressure, no perfection.
          </p>
        </aside>
      </div>
      <footer className="footer-note">Made for the little things that make a life.</footer>
    </main>
  );
}
