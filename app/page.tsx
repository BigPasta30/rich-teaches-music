"use client";

/* =========================
   Types
========================= */

type Track = {
  id: string;
  title: string;
  artist?: string;
  bpm?: number;
  key?: string; // Camelot key like "8A"
};

type Camelot = { n: number; l: "A" | "B" };
type MoveType = "perfect" | "relative" | "neighbor" | "clash" | "unknown";

/* =========================
   Demo Data
========================= */

const demo: Track[] = [
  { id: "1", title: "Track One", artist: "DJ Example", bpm: 64, key: "8A" },
  { id: "2", title: "Track Two", artist: "DJ Example", bpm: 66, key: "8B" },
  { id: "3", title: "Track Three", artist: "DJ Example", bpm: 65, key: "9B" },
  { id: "4", title: "Track Four", artist: "DJ Example", bpm: 67, key: "10B" },
  { id: "5", title: "Track Five", artist: "DJ Example", bpm: 62, key: "7A" },
];

/* =========================
   Camelot Helpers
========================= */

function parseCamelot(key?: string): Camelot | undefined {
  if (!key) return undefined;
  const m = key.trim().toUpperCase().match(/^([1-9]|1[0-2])([AB])$/);
  if (!m) return undefined;
  return { n: Number(m[1]), l: m[2] as "A" | "B" };
}

function wrap12(n: number) {
  const r = n % 12;
  return r === 0 ? 12 : r;
}

function camelotMoveType(fromKey?: string, toKey?: string): MoveType {
  const from = parseCamelot(fromKey);
  const to = parseCamelot(toKey);
  if (!from || !to) return "unknown";

  // Same exact key
  if (from.n === to.n && from.l === to.l) return "perfect";

  // Relative major/minor
  if (from.n === to.n && from.l !== to.l) return "relative";

  // Neighbor keys (+/- 1, same letter)
  const up = wrap12(from.n + 1);
  const down = wrap12(from.n - 1);
  if (from.l === to.l && (to.n === up || to.n === down)) return "neighbor";

  return "clash";
}

function camelotColor(move: MoveType) {
  switch (move) {
    case "perfect":
      return "bg-emerald-500";
    case "relative":
    case "neighbor":
      return "bg-lime-500";
    case "clash":
      return "bg-rose-500";
    default:
      return "bg-slate-400";
  }
}

function camelotLabel(move: MoveType) {
  switch (move) {
    case "perfect":
      return "Perfect (same key)";
    case "relative":
      return "Relative (A↔B)";
    case "neighbor":
      return "Neighbor (±1)";
    case "clash":
      return "Clash";
    default:
      return "Unknown";
  }
}

/* =========================
   Arrow Component
========================= */

function Arrow({
  dir,
  color,
  title,
}: {
  dir: "up" | "down" | "none";
  color: string;
  title: string;
}) {
  const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : "•";
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs text-white ${color}`}
      title={title}
      aria-label={title}
    >
      {glyph}
    </span>
  );
}

/* =========================
   Page
========================= */

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <h1 className="text-3xl font-semibold">Rich Teaches Music</h1>
      <p className="mt-2 text-slate-300">
        Music theory, taught while music is happening.
      </p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Track</th>
              <th className="px-4 py-3">Artist</th>
              <th className="px-4 py-3">BPM</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Circle</th>
            </tr>
          </thead>

          <tbody>
            {demo.map((t, i) => {
              const above = demo[i - 1];
              const below = demo[i + 1];

              const upMove = camelotMoveType(t.key, above?.key);
              const downMove = camelotMoveType(t.key, below?.key);

              return (
                <tr
                  key={t.id}
                  className="border-t border-slate-800 hover:bg-slate-900/40"
                >
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>

                  <td className="px-4 py-3 font-medium">{t.title}</td>

                  <td className="px-4 py-3 text-slate-300">
                    {t.artist ?? "—"}
                  </td>

                  <td className="px-4 py-3 tabular-nums">
                    {t.bpm ?? "—"}
                  </td>

                  <td className="px-4 py-3">{t.key ?? "—"}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-2">
                        <Arrow
                          dir={above ? "up" : "none"}
                          color={camelotColor(upMove)}
                          title={
                            above
                              ? `Above: ${camelotLabel(upMove)} (${above.key})`
                              : "No track above"
                          }
                        />
                        <Arrow
                          dir={below ? "down" : "none"}
                          color={camelotColor(downMove)}
                          title={
                            below
                              ? `Below: ${camelotLabel(downMove)} (${below.key})`
                              : "No track below"
                          }
                        />
                      </div>

                      <span className="text-xs text-slate-400">
                        {above ? `↑ ${above.key}` : "↑ —"}{" "}
                        <span className="mx-1">•</span>{" "}
                        {below ? `↓ ${below.key}` : "↓ —"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
          <span className="mr-4">
            <span className="inline-block h-2 w-2 rounded bg-emerald-500 mr-1" />
            Perfect
          </span>
          <span className="mr-4">
            <span className="inline-block h-2 w-2 rounded bg-lime-500 mr-1" />
            Neighbor / Relative
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded bg-rose-500 mr-1" />
            Clash
          </span>
        </div>
      </div>
    </main>
  );
}