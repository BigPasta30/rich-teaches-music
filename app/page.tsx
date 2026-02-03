"use client";

import React, { useMemo, useState } from "react";

/**
 * Rich Teaches Music — MVP table
 * - Proper Camelot compatibility
 * - Allowed destination keys (chips)
 * - Click-to-edit cells
 * - Works in Next.js App Router
 */

type CamelotLetter = "A" | "B";
type Camelot = { n: number; l: CamelotLetter };

type Track = {
  id: string;
  title: string;
  artist?: string;
  bpm?: number;
  key?: string; // "8A", "10B", etc.
};

const demoSeed: Track[] = [
  { id: "1", title: "Track One", artist: "DJ Example", bpm: 64, key: "8A" },
  { id: "2", title: "Track Two", artist: "DJ Example", bpm: 66, key: "8B" },
  { id: "3", title: "Track Three", artist: "DJ Example", bpm: 65, key: "9B" },
  { id: "4", title: "Track Four", artist: "DJ Example", bpm: 67, key: "10B" },
  { id: "5", title: "Track Five", artist: "DJ Example", bpm: 62, key: "7A" },
];

type CompatLevel = "perfect" | "neighbor" | "clash" | "none";

function clampCamelot(n: number) {
  // wrap 1..12
  const x = ((n - 1) % 12 + 12) % 12; // 0..11
  return x + 1;
}

function parseCamelot(key?: string): Camelot | undefined {
  if (!key) return undefined;
  const s = key.trim().toUpperCase();
  // accept like "8A", "10B", also allow "08A"
  const m = s.match(/^0*([1-9]|1[0-2])\s*([AB])$/);
  if (!m) return undefined;
  return { n: clampCamelot(Number(m[1])), l: m[2] as CamelotLetter };
}

function camelotToString(c?: Camelot) {
  if (!c) return "—";
  return `${c.n}${c.l}`;
}

function flipLetter(l: CamelotLetter): CamelotLetter {
  return l === "A" ? "B" : "A";
}

function circularStep(from: number, to: number) {
  // returns minimal signed step in {-6..+6} (except 6 ambiguous, pick +6)
  const a = clampCamelot(from);
  const b = clampCamelot(to);
  const forward = ((b - a) % 12 + 12) % 12; // 0..11
  const backward = forward - 12; // -12..-1 or 0
  if (Math.abs(backward) < Math.abs(forward)) return backward; // negative
  return forward; // positive or 0
}

/**
 * Proper Camelot compatibility rules (core):
 * - perfect: same number AND same letter (8A -> 8A)
 * - neighbor/relative:
 *    - same number, other letter (8A <-> 8B) [relative major/minor]
 *    - +/-1 number, same letter (8A <-> 7A or 9A)
 * - clash: everything else (including +/-2 etc for now)
 */
function camelotCompatibility(from?: Camelot, to?: Camelot): CompatLevel {
  if (!from || !to) return "none";
  if (from.n === to.n && from.l === to.l) return "perfect";
  if (from.n === to.n && from.l !== to.l) return "neighbor";
  const step = circularStep(from.n, to.n);
  if (Math.abs(step) === 1 && from.l === to.l) return "neighbor";
  return "clash";
}

function levelStyles(level: CompatLevel) {
  // green / lime / red / neutral
  switch (level) {
    case "perfect":
      return {
        dot: "bg-emerald-400",
        box: "bg-emerald-500/90 text-slate-950",
        text: "text-emerald-300",
        label: "Perfect",
      };
    case "neighbor":
      return {
        dot: "bg-lime-400",
        box: "bg-lime-500/90 text-slate-950",
        text: "text-lime-300",
        label: "Neighbor / Relative",
      };
    case "clash":
      return {
        dot: "bg-rose-400",
        box: "bg-rose-500/90 text-slate-950",
        text: "text-rose-300",
        label: "Clash",
      };
    default:
      return {
        dot: "bg-slate-500",
        box: "bg-slate-700/70 text-slate-200",
        text: "text-slate-400",
        label: "—",
      };
  }
}

function Arrow({
  dir,
  level,
  title,
}: {
  dir: "up" | "down";
  level: CompatLevel;
  title: string;
}) {
  const s = levelStyles(level);
  const symbol = dir === "up" ? "▲" : "▼";
  return (
    <span
      title={title}
      className={[
        "inline-flex items-center justify-center",
        "w-6 h-6 rounded-md text-xs font-black",
        "select-none",
        s.box,
      ].join(" ")}
    >
      {symbol}
    </span>
  );
}

/** Allowed destination keys for a current Camelot key */
function allowedDestinations(from?: Camelot): Camelot[] {
  if (!from) return [];
  const a = clampCamelot(from.n - 1);
  const b = clampCamelot(from.n + 1);
  const list: Camelot[] = [
    { n: from.n, l: from.l }, // same
    { n: a, l: from.l }, // -1 same letter
    { n: b, l: from.l }, // +1 same letter
    { n: from.n, l: flipLetter(from.l) }, // relative A<->B
  ];
  // unique by string
  const seen = new Set<string>();
  return list.filter((c) => {
    const k = camelotToString(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function isAllowed(from?: Camelot, to?: Camelot) {
  if (!from || !to) return false;
  const allowed = allowedDestinations(from).map(camelotToString);
  return allowed.includes(camelotToString(to));
}

/** ---------- Click-to-edit helpers ---------- */

type EditableField = "title" | "artist" | "bpm" | "key";
type Editing = { id: string; field: EditableField } | null;

function isEditing(editing: Editing, id: string, field: EditableField) {
  return !!editing && editing.id === id && editing.field === field;
}

function normalizeKeyInput(v: string) {
  return v.toUpperCase().replace(/\s+/g, "");
}

function Chip({
  label,
  tone,
  title,
}: {
  label: string;
  tone: "base" | "hitUp" | "hitDown";
  title?: string;
}) {
  const cls =
    tone === "hitUp"
      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
      : tone === "hitDown"
      ? "border-lime-500/40 bg-lime-500/15 text-lime-200"
      : "border-slate-700 bg-slate-900/60 text-slate-300";
  return (
    <span
      title={title}
      className={[
        "inline-flex items-center rounded-md border px-2 py-1",
        "text-[11px] leading-none font-medium",
        cls,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>(demoSeed);
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<string>("");

  const parsed = useMemo(() => {
    return tracks.map((t) => ({
      ...t,
      camelot: parseCamelot(t.key),
    }));
  }, [tracks]);

  function startEdit(id: string, field: EditableField, initial: string) {
    setEditing({ id, field });
    setDraft(initial);
  }

  function commitEdit(id: string, field: EditableField) {
    setTracks((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;

        if (field === "bpm") {
          const n = Number(draft.trim());
          if (draft.trim() === "") return { ...t, bpm: undefined };
          if (!Number.isFinite(n)) return t;
          return { ...t, bpm: Math.max(0, Math.round(n)) };
        }

        if (field === "key") {
          const k = draft.trim() === "" ? undefined : normalizeKeyInput(draft);
          return { ...t, key: k };
        }

        if (field === "artist") {
          const v = draft.trim();
          return { ...t, artist: v === "" ? undefined : v };
        }

        return { ...t, title: draft.trim() === "" ? t.title : draft };
      })
    );
    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="text-4xl font-semibold tracking-tight">Rich Teaches Music</h1>
        <p className="mt-2 text-slate-300">Music theory, taught while music is happening.</p>

        <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/40 shadow-xl backdrop-blur">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-sm text-slate-300">
                  <th className="px-4 py-3 text-left font-medium">#</th>
                  <th className="px-4 py-3 text-left font-medium">Track</th>
                  <th className="px-4 py-3 text-left font-medium">Artist</th>
                  <th className="px-4 py-3 text-left font-medium">BPM</th>
                  <th className="px-4 py-3 text-left font-medium">Key</th>
                  <th className="px-4 py-3 text-left font-medium">Circle</th>
                </tr>
              </thead>

              <tbody>
                {parsed.map((t, i) => {
                  const above = i > 0 ? parsed[i - 1] : undefined;
                  const below = i < parsed.length - 1 ? parsed[i + 1] : undefined;

                  const upLevel = camelotCompatibility(t.camelot, above?.camelot);
                  const downLevel = camelotCompatibility(t.camelot, below?.camelot);

                  const upStr = above?.camelot ? camelotToString(above.camelot) : "—";
                  const downStr = below?.camelot ? camelotToString(below.camelot) : "—";

                  const allowed = allowedDestinations(t.camelot).map(camelotToString);
                  const hitUp = isAllowed(t.camelot, above?.camelot);
                  const hitDown = isAllowed(t.camelot, below?.camelot);

                  return (
                    <tr
                      key={t.id}
                      className="border-t border-slate-800 hover:bg-slate-900/60"
                    >
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>

                      {/* Track */}
                      <td className="px-4 py-3">
                        {isEditing(editing, t.id, "title") ? (
                          <input
                            autoFocus
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none focus:border-slate-500"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitEdit(t.id, "title")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit(t.id, "title");
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <div
                            className="cursor-text font-medium"
                            title="Click to edit"
                            onClick={() => startEdit(t.id, "title", t.title)}
                          >
                            {t.title}
                          </div>
                        )}
                      </td>

                      {/* Artist */}
                      <td className="px-4 py-3 text-slate-300">
                        {isEditing(editing, t.id, "artist") ? (
                          <input
                            autoFocus
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none focus:border-slate-500"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitEdit(t.id, "artist")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit(t.id, "artist");
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <div
                            className="cursor-text"
                            title="Click to edit"
                            onClick={() => startEdit(t.id, "artist", t.artist ?? "")}
                          >
                            {t.artist ?? "—"}
                          </div>
                        )}
                      </td>

                      {/* BPM */}
                      <td className="px-4 py-3 tabular-nums text-slate-200">
                        {isEditing(editing, t.id, "bpm") ? (
                          <input
                            autoFocus
                            inputMode="numeric"
                            className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none focus:border-slate-500"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitEdit(t.id, "bpm")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit(t.id, "bpm");
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <div
                            className="cursor-text"
                            title="Click to edit"
                            onClick={() => startEdit(t.id, "bpm", t.bpm?.toString() ?? "")}
                          >
                            {t.bpm ?? "—"}
                          </div>
                        )}
                      </td>

                      {/* Key */}
                      <td className="px-4 py-3 text-slate-200">
                        {isEditing(editing, t.id, "key") ? (
                          <input
                            autoFocus
                            className="w-24 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none focus:border-slate-500"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitEdit(t.id, "key")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit(t.id, "key");
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <div
                            className="cursor-text"
                            title="Click to edit (e.g., 8A, 10B)"
                            onClick={() => startEdit(t.id, "key", t.key ?? "")}
                          >
                            {t.key ?? "—"}
                          </div>
                        )}
                      </td>

                      {/* Circle / Compatibility + Allowed destinations */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            {/* arrows */}
                            <div className="flex items-center gap-2">
                              <Arrow
                                dir="up"
                                level={upLevel}
                                title={
                                  above?.camelot
                                    ? `Above: ${camelotToString(above.camelot)} • ${
                                        levelStyles(upLevel).label
                                      }`
                                    : "No track above"
                                }
                              />
                              <Arrow
                                dir="down"
                                level={downLevel}
                                title={
                                  below?.camelot
                                    ? `Below: ${camelotToString(below.camelot)} • ${
                                        levelStyles(downLevel).label
                                      }`
                                    : "No track below"
                                }
                              />
                            </div>

                            {/* small text */}
                            <div className="text-xs text-slate-400">
                              <span className="mr-2">↑ {upStr}</span>
                              <span className="text-slate-600">•</span>
                              <span className="ml-2">↓ {downStr}</span>
                            </div>
                          </div>

                          {/* Allowed destination keys chips */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-500 mr-1">
                              Allowed:
                            </span>

                            {allowed.length === 0 ? (
                              <Chip label="—" tone="base" title="Enter a Camelot key like 8A" />
                            ) : (
                              allowed.map((k) => {
                                const tone =
                                  hitUp && k === upStr
                                    ? "hitUp"
                                    : hitDown && k === downStr
                                    ? "hitDown"
                                    : "base";
                                const tip =
                                  tone === "hitUp"
                                    ? "Matches track above"
                                    : tone === "hitDown"
                                    ? "Matches track below"
                                    : "Allowed destination";
                                return <Chip key={k} label={k} tone={tone} title={tip} />;
                              })
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 border-t border-slate-800 px-6 py-4 text-sm">
            {(["perfect", "neighbor", "clash"] as CompatLevel[]).map((lvl) => {
              const s = levelStyles(lvl);
              return (
                <div key={lvl} className="flex items-center gap-2 text-slate-300">
                  <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                  <span>{s.label}</span>
                </div>
              );
            })}
            <div className="ml-auto text-xs text-slate-500">
              Allowed destinations = same key • ±1 same letter • same number A↔B
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Tip: click any Title / Artist / BPM / Key cell to edit. Press Enter to save, Esc to cancel.
        </div>
      </div>
    </main>
  );
}