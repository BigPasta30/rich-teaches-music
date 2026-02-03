"use client";

import React, { useMemo, useState } from "react";

/**
 * Rich Teaches Music — MVP table
 * Adds:
 * - Camelot: Into + From
 * - BPM rules:
 *   1) Half-time / double-time recognition (÷2, ×2)
 *   2) Genre BPM ranges (downgrade if out of range)
 *   3) More drift allowed if key is PERFECT
 */

type CamelotLetter = "A" | "B";
type Camelot = { n: number; l: CamelotLetter };

type Track = {
  id: string;
  title: string;
  artist?: string;
  genre?: string; // new
  bpm?: number;
  key?: string; // "8A", "10B", etc.
};

const demoSeed: Track[] = [
  { id: "1", title: "Track One", artist: "DJ Example", genre: "hiphop", bpm: 64, key: "8A" },
  { id: "2", title: "Track Two", artist: "DJ Example", genre: "hiphop", bpm: 66, key: "8B" },
  { id: "3", title: "Track Three", artist: "DJ Example", genre: "hiphop", bpm: 65, key: "9B" },
  { id: "4", title: "Track Four", artist: "DJ Example", genre: "house", bpm: 128, key: "10B" },
  { id: "5", title: "Track Five", artist: "DJ Example", genre: "house", bpm: 126, key: "7A" },
];

type CompatLevel = "perfect" | "neighbor" | "clash" | "none";

/** ---------- Camelot helpers ---------- */

function clampCamelot(n: number) {
  const x = ((n - 1) % 12 + 12) % 12; // 0..11
  return x + 1;
}

function parseCamelot(key?: string): Camelot | undefined {
  if (!key) return undefined;
  const s = key.trim().toUpperCase();
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
  const a = clampCamelot(from);
  const b = clampCamelot(to);
  const forward = ((b - a) % 12 + 12) % 12; // 0..11
  const backward = forward - 12; // -12..-1 or 0
  if (Math.abs(backward) < Math.abs(forward)) return backward;
  return forward;
}

function camelotCompatibility(from?: Camelot, to?: Camelot): CompatLevel {
  if (!from || !to) return "none";
  if (from.n === to.n && from.l === to.l) return "perfect";
  if (from.n === to.n && from.l !== to.l) return "neighbor";
  const step = circularStep(from.n, to.n);
  if (Math.abs(step) === 1 && from.l === to.l) return "neighbor";
  return "clash";
}

/** Allowed destination keys for a source Camelot key */
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

/** ---------- BPM helpers (3-rule system) ---------- */

// Rule 2: Genre BPM ranges
const GENRE_RANGES: Record<string, { min: number; max: number }> = {
  house: { min: 118, max: 135 },
  techno: { min: 120, max: 145 },
  dnb: { min: 160, max: 178 },
  jungle: { min: 160, max: 180 },
  dubstep: { min: 135, max: 150 },
  trap: { min: 120, max: 155 }, // many are halftime-feel
  hiphop: { min: 60, max: 105 },
  rnb: { min: 60, max: 110 },
  pop: { min: 80, max: 140 },
  ambient: { min: 50, max: 90 },
  downtempo: { min: 70, max: 110 },
};

function genreRange(genre?: string) {
  if (!genre) return undefined;
  const key = genre.trim().toLowerCase();
  return GENRE_RANGES[key];
}

function inGenreRange(bpm?: number, genre?: string) {
  if (bpm == null) return false;
  const r = genreRange(genre);
  if (!r) return true; // unknown genre => don't penalize
  return bpm >= r.min && bpm <= r.max;
}

// Rule 1: Half-time / double-time recognition
type BpmMatch = {
  adjustedTo: number; // to bpm after ÷2/×2 choice
  factor: "x1" | "x2" | "d2";
  delta: number; // adjustedTo - from
};

function bestBpmMatch(from?: number, to?: number): BpmMatch | undefined {
  if (from == null || to == null) return undefined;

  // candidates are "what if the other track is interpreted as half/double time"
  const candidates: Array<{ adjustedTo: number; factor: BpmMatch["factor"] }> = [
    { adjustedTo: to, factor: "x1" },
    { adjustedTo: to * 2, factor: "x2" },
    { adjustedTo: to / 2, factor: "d2" },
  ].filter((c) => c.adjustedTo >= 40 && c.adjustedTo <= 220);

  let best = candidates[0];
  let bestAbs = Math.abs(best.adjustedTo - from);

  for (const c of candidates.slice(1)) {
    const a = Math.abs(c.adjustedTo - from);
    if (a < bestAbs) {
      best = c;
      bestAbs = a;
    }
  }

  return { adjustedTo: best.adjustedTo, factor: best.factor, delta: best.adjustedTo - from };
}

function thresholdsForBpm(keyLevel: CompatLevel) {
  // Rule 3: More drift allowed if key is PERFECT
  // normal: perfect<=2, neighbor<=5
  // key-perfect: perfect<=4, neighbor<=8
  if (keyLevel === "perfect") return { perfect: 4, neighbor: 8 };
  return { perfect: 2, neighbor: 5 };
}

function degrade(level: CompatLevel): CompatLevel {
  if (level === "perfect") return "neighbor";
  if (level === "neighbor") return "clash";
  return level;
}

/**
 * BPM compatibility using:
 * - bestBpmMatch (half/double time)
 * - genre range downgrade
 * - key-perfect wider thresholds
 */
function bpmCompatibilityAdvanced(opts: {
  fromBpm?: number;
  toBpm?: number;
  fromGenre?: string;
  toGenre?: string;
  keyLevel: CompatLevel;
}): { level: CompatLevel; match?: BpmMatch; penalizedByGenre: boolean } {
  const { fromBpm, toBpm, fromGenre, toGenre, keyLevel } = opts;
  if (fromBpm == null || toBpm == null) return { level: "none", penalizedByGenre: false };

  const match = bestBpmMatch(fromBpm, toBpm);
  if (!match) return { level: "none", penalizedByGenre: false };

  const t = thresholdsForBpm(keyLevel);
  const abs = Math.abs(match.delta);

  let level: CompatLevel;
  if (abs <= t.perfect) level = "perfect";
  else if (abs <= t.neighbor) level = "neighbor";
  else level = "clash";

  const fromOk = inGenreRange(fromBpm, fromGenre);
  // for the to-track, use its *actual* bpm vs its genre; if it's "wild" we penalize
  const toOk = inGenreRange(toBpm, toGenre);

  const penalizedByGenre = !(fromOk && toOk);
  if (penalizedByGenre && (level === "perfect" || level === "neighbor")) {
    level = degrade(level); // downgrade one notch
  }

  return { level, match, penalizedByGenre };
}

/** ---------- UI helpers ---------- */

function levelStyles(level: CompatLevel) {
  switch (level) {
    case "perfect":
      return {
        dot: "bg-emerald-400",
        box: "bg-emerald-500/90 text-slate-950",
        chip: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
        text: "text-emerald-300",
        label: "Perfect",
      };
    case "neighbor":
      return {
        dot: "bg-lime-400",
        box: "bg-lime-500/90 text-slate-950",
        chip: "border-lime-500/40 bg-lime-500/15 text-lime-200",
        text: "text-lime-300",
        label: "Neighbor / Relative",
      };
    case "clash":
      return {
        dot: "bg-rose-400",
        box: "bg-rose-500/90 text-slate-950",
        chip: "border-rose-500/40 bg-rose-500/15 text-rose-200",
        text: "text-rose-300",
        label: "Clash",
      };
    default:
      return {
        dot: "bg-slate-500",
        box: "bg-slate-700/70 text-slate-200",
        chip: "border-slate-700 bg-slate-900/60 text-slate-300",
        text: "text-slate-400",
        label: "—",
      };
  }
}

function Arrow({
  dir,
  level,
  title,
  label,
}: {
  dir: "up" | "down";
  level: CompatLevel;
  title: string;
  label?: string;
}) {
  const s = levelStyles(level);
  const symbol = dir === "up" ? "▲" : "▼";
  return (
    <span
      title={title}
      className={[
        "inline-flex items-center justify-center gap-1",
        "min-w-6 h-6 rounded-md text-xs font-black",
        "select-none px-2",
        s.box,
      ].join(" ")}
    >
      <span>{symbol}</span>
      {label ? <span className="tabular-nums">{label}</span> : null}
    </span>
  );
}

function Chip({
  label,
  tone,
  title,
}: {
  label: string;
  tone: CompatLevel;
  title?: string;
}) {
  const s = levelStyles(tone);
  return (
    <span
      title={title}
      className={[
        "inline-flex items-center rounded-md border px-2 py-1",
        "text-[11px] leading-none font-medium",
        s.chip,
      ].join(" ")}
    >
      {label}
    </span>
  );
}

/** ---------- Click-to-edit helpers ---------- */

type EditableField = "title" | "artist" | "genre" | "bpm" | "key";
type Editing = { id: string; field: EditableField } | null;

function isEditing(editing: Editing, id: string, field: EditableField) {
  return !!editing && editing.id === id && editing.field === field;
}

function normalizeKeyInput(v: string) {
  return v.toUpperCase().replace(/\s+/g, "");
}

export default function Home() {
  const [tracks, setTracks] = useState<Track[]>(demoSeed);
  const [editing, setEditing] = useState<Editing>(null);
  const [draft, setDraft] = useState<string>("");

  const parsed = useMemo(() => {
    return tracks.map((t) => ({
      ...t,
      camelot: parseCamelot(t.key),
      genreNorm: t.genre?.trim().toLowerCase(),
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
          const v = draft.trim();
          if (v === "") return { ...t, bpm: undefined };
          const n = Number(v);
          if (!Number.isFinite(n)) return t;
          return { ...t, bpm: Math.max(0, Math.round(n)) };
        }

        if (field === "key") {
          const v = draft.trim();
          if (v === "") return { ...t, key: undefined };
          return { ...t, key: normalizeKeyInput(v) };
        }

        if (field === "artist") {
          const v = draft.trim();
          return { ...t, artist: v === "" ? undefined : v };
        }

        if (field === "genre") {
          const v = draft.trim();
          return { ...t, genre: v === "" ? undefined : v };
        }

        const v = draft.trim();
        return { ...t, title: v === "" ? t.title : v };
      })
    );
    setEditing(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  function bpmFactorLabel(f?: "x1" | "x2" | "d2") {
    if (!f || f === "x1") return "";
    return f === "x2" ? "×2" : "÷2";
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900 text-slate-100">
      <div className="mx-auto max-w-6xl px-6 py-12">
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
                  <th className="px-4 py-3 text-left font-medium">Genre</th>
                  <th className="px-4 py-3 text-left font-medium">BPM</th>
                  <th className="px-4 py-3 text-left font-medium">Key</th>
                  <th className="px-4 py-3 text-left font-medium">Compatibility</th>
                </tr>
              </thead>

              <tbody>
                {parsed.map((t, i) => {
                  const above = i > 0 ? parsed[i - 1] : undefined;
                  const below = i < parsed.length - 1 ? parsed[i + 1] : undefined;

                  // Camelot compat (current -> neighbor)
                  const keyUpLevel = camelotCompatibility(t.camelot, above?.camelot);
                  const keyDownLevel = camelotCompatibility(t.camelot, below?.camelot);

                  const upKeyStr = above?.camelot ? camelotToString(above.camelot) : "—";
                  const downKeyStr = below?.camelot ? camelotToString(below.camelot) : "—";

                  // BPM compat uses 3-rule system, and key-perfect drift
                  const bpmUp = bpmCompatibilityAdvanced({
                    fromBpm: t.bpm,
                    toBpm: above?.bpm,
                    fromGenre: t.genreNorm,
                    toGenre: above?.genreNorm,
                    keyLevel: keyUpLevel,
                  });

                  const bpmDown = bpmCompatibilityAdvanced({
                    fromBpm: t.bpm,
                    toBpm: below?.bpm,
                    fromGenre: t.genreNorm,
                    toGenre: below?.genreNorm,
                    keyLevel: keyDownLevel,
                  });

                  // Labels show signed delta against best matched BPM, plus factor if used
                  const upDelta = bpmUp.match?.delta;
                  const downDelta = bpmDown.match?.delta;

                  const upLabel =
                    upDelta == null
                      ? ""
                      : `${upDelta > 0 ? "+" : ""}${Math.round(upDelta)}${bpmFactorLabel(
                          bpmUp.match?.factor
                        ) ? ` ${bpmFactorLabel(bpmUp.match?.factor)}` : ""}`;

                  const downLabel =
                    downDelta == null
                      ? ""
                      : `${downDelta > 0 ? "+" : ""}${Math.round(downDelta)}${bpmFactorLabel(
                          bpmDown.match?.factor
                        ) ? ` ${bpmFactorLabel(bpmDown.match?.factor)}` : ""}`;

                  // INTO this track (allowed based on ABOVE)
                  const intoKeys = allowedDestinations(above?.camelot).map(camelotToString);
                  const thisKeyStr = camelotToString(t.camelot);
                  const intoHit = isAllowed(above?.camelot, t.camelot);

                  // FROM this track (allowed based on CURRENT)
                  const fromKeys = allowedDestinations(t.camelot).map(camelotToString);
                  const hitAboveFrom = isAllowed(t.camelot, above?.camelot);
                  const hitBelowFrom = isAllowed(t.camelot, below?.camelot);

                  return (
                    <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-900/60">
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

                      {/* Genre */}
                      <td className="px-4 py-3 text-slate-300">
                        {isEditing(editing, t.id, "genre") ? (
                          <input
                            autoFocus
                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100 outline-none focus:border-slate-500"
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onBlur={() => commitEdit(t.id, "genre")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEdit(t.id, "genre");
                              if (e.key === "Escape") cancelEdit();
                            }}
                          />
                        ) : (
                          <div
                            className="cursor-text"
                            title="Click to edit (e.g., house, hiphop, dnb, techno)"
                            onClick={() => startEdit(t.id, "genre", t.genre ?? "")}
                          >
                            {t.genre ?? "—"}
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

                      {/* Compatibility */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-3">
                          {/* Row 1: Camelot */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-[11px] text-slate-500 w-16">Camelot</div>
                            <div className="flex items-center gap-2">
                              <Arrow
                                dir="up"
                                level={keyUpLevel}
                                title={
                                  above?.camelot
                                    ? `Above key: ${upKeyStr} • ${levelStyles(keyUpLevel).label}`
                                    : "No track above"
                                }
                              />
                              <Arrow
                                dir="down"
                                level={keyDownLevel}
                                title={
                                  below?.camelot
                                    ? `Below key: ${downKeyStr} • ${levelStyles(keyDownLevel).label}`
                                    : "No track below"
                                }
                              />
                            </div>
                            <div className="text-xs text-slate-400">
                              <span className="mr-2">↑ {upKeyStr}</span>
                              <span className="text-slate-600">•</span>
                              <span className="ml-2">↓ {downKeyStr}</span>
                            </div>
                          </div>

                          {/* Row 2: BPM (3 rules) */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-[11px] text-slate-500 w-16">BPM</div>
                            <div className="flex items-center gap-2">
                              <Arrow
                                dir="up"
                                level={bpmUp.level}
                                label={upLabel}
                                title={
                                  above?.bpm != null && t.bpm != null
                                    ? [
                                        `Above BPM: ${above.bpm} (best match: ${Math.round(
                                          bpmUp.match?.adjustedTo ?? above.bpm
                                        )}${bpmFactorLabel(bpmUp.match?.factor) ? ` ${bpmFactorLabel(bpmUp.match?.factor)}` : ""})`,
                                        `Δ: ${Math.round(Math.abs(bpmUp.match?.delta ?? 0))}`,
                                        `Key drift thresholds: ${
                                          keyUpLevel === "perfect" ? "wider (key perfect)" : "normal"
                                        }`,
                                        bpmUp.penalizedByGenre
                                          ? "Genre range penalty applied"
                                          : "Genre range OK",
                                      ].join(" • ")
                                    : "No BPM above"
                                }
                              />
                              <Arrow
                                dir="down"
                                level={bpmDown.level}
                                label={downLabel}
                                title={
                                  below?.bpm != null && t.bpm != null
                                    ? [
                                        `Below BPM: ${below.bpm} (best match: ${Math.round(
                                          bpmDown.match?.adjustedTo ?? below.bpm
                                        )}${bpmFactorLabel(bpmDown.match?.factor) ? ` ${bpmFactorLabel(bpmDown.match?.factor)}` : ""})`,
                                        `Δ: ${Math.round(Math.abs(bpmDown.match?.delta ?? 0))}`,
                                        `Key drift thresholds: ${
                                          keyDownLevel === "perfect" ? "wider (key perfect)" : "normal"
                                        }`,
                                        bpmDown.penalizedByGenre
                                          ? "Genre range penalty applied"
                                          : "Genre range OK",
                                      ].join(" • ")
                                    : "No BPM below"
                                }
                              />
                            </div>

                            <div className="text-xs text-slate-400">
                              <span className="mr-2">↑ {above?.bpm ?? "—"}</span>
                              <span className="text-slate-600">•</span>
                              <span className="ml-2">↓ {below?.bpm ?? "—"}</span>
                            </div>
                          </div>

                          {/* Row 3: INTO this track (based on ABOVE) */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-500 w-16">Into</span>
                            {intoKeys.length === 0 ? (
                              <Chip label="—" tone="none" title="No track above (or invalid key above)" />
                            ) : (
                              <>
                                {intoKeys.map((k) => {
                                  const tone: CompatLevel =
                                    k === thisKeyStr ? (intoHit ? "perfect" : "clash") : "none";
                                  const tip =
                                    k === thisKeyStr
                                      ? intoHit
                                        ? "This track's key is allowed from above"
                                        : "This track's key is NOT allowed from above"
                                      : "Allowed from above";
                                  return (
                                    <Chip key={`into-${t.id}-${k}`} label={k} tone={tone} title={tip} />
                                  );
                                })}
                                <span className="ml-2 text-[11px] text-slate-400">
                                  (Above → This: {intoHit ? "allowed" : "not allowed"})
                                </span>
                              </>
                            )}
                          </div>

                          {/* Row 4: FROM this track (based on CURRENT) */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-slate-500 w-16">From</span>
                            {fromKeys.length === 0 ? (
                              <Chip
                                label="—"
                                tone="none"
                                title="Enter a Camelot key like 8A to get allowed destinations"
                              />
                            ) : (
                              <>
                                {fromKeys.map((k) => {
                                  const tone: CompatLevel =
                                    (hitAboveFrom && k === upKeyStr) || (hitBelowFrom && k === downKeyStr)
                                      ? "neighbor"
                                      : "none";
                                  const tip =
                                    hitAboveFrom && k === upKeyStr
                                      ? "Matches track above"
                                      : hitBelowFrom && k === downKeyStr
                                      ? "Matches track below"
                                      : "Allowed destination from this track";
                                  return (
                                    <Chip key={`from-${t.id}-${k}`} label={k} tone={tone} title={tip} />
                                  );
                                })}
                              </>
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

          {/* Legends */}
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
              Camelot allowed: same • ±1 same letter • same # A↔B | BPM: uses ÷2/×2 match, genre ranges, and wider drift if key perfect
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          Tip: click any Title / Artist / Genre / BPM / Key cell to edit. Press Enter to save, Esc to cancel.
        </div>
      </div>
    </main>
  );
}

