type CircleSystem = "camelot" | "fourths"; // placeholder for later

type Track = {
  id: string;
  title: string;
  artist?: string;
  bpm?: number;
  key?: string; // e.g. "8A" for Camelot, or "C major" later
  circle?: number; // numeric position on the chosen circle system
  system?: CircleSystem;
};

const demo: Track[] = [
  { id: "1", title: "Track One", artist: "DJ Example", bpm: 64, key: "8A", circle: 8, system: "camelot" },
  { id: "2", title: "Track Two", artist: "DJ Example", bpm: 66, key: "9A", circle: 9, system: "camelot" },
  { id: "3", title: "Track Three", artist: "DJ Example", bpm: 65, key: "9B", circle: 9, system: "camelot" },
  { id: "4", title: "Track Four", artist: "DJ Example", bpm: 67, key: "10B", circle: 10, system: "camelot" },
];

// distance on a circle 1..12 (wrap-around)
function circularDistance(a?: number, b?: number) {
  if (!a || !b) return undefined;
  const diff = Math.abs(a - b);
  return Math.min(diff, 12 - diff);
}

// map distance -> a simple compatibility color
function compatibilityColor(distance?: number) {
  if (distance === undefined) return "bg-slate-300";
  if (distance === 0) return "bg-emerald-500"; // same
  if (distance === 1) return "bg-lime-500"; // adjacent
  if (distance === 2) return "bg-amber-500"; // workable
  return "bg-rose-500"; // clash (for now)
}

// arrow direction relative to current row’s circle number
function direction(from?: number, to?: number): "up" | "down" | "same" | "none" {
  if (!from || !to) return "none";
  if (to > from) return "up";
  if (to < from) return "down";
  return "same";
}

function Arrow({
  dir,
  colorClass,
  title,
}: {
  dir: "up" | "down" | "same" | "none";
  colorClass: string;
  title: string;
}) {
  const glyph = dir === "up" ? "▲" : dir === "down" ? "▼" : dir === "same" ? "•" : "–";
  return (
    <span
      className={`inline-flex h-5 w-5 items-center justify-center rounded text-white text-xs ${colorClass}`}
      title={title}
      aria-label={title}
    >
      {glyph}
    </span>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight">Rich Teaches Music</h1>
          <p className="mt-2 text-slate-300">
            Music theory, taught while music is happening.
          </p>
        </header>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <div>
              <h2 className="font-medium">Track Table</h2>
              <p className="text-sm text-slate-400">
                Circle column shows compatibility + direction vs the track above/below.
              </p>
            </div>
            <span className="text-xs text-slate-400">
              System: <span className="text-slate-200 font-medium">Camelot (demo)</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-900">
                <tr className="text-left text-slate-300">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Track</th>
                  <th className="px-4 py-3 font-medium">Artist</th>
                  <th className="px-4 py-3 font-medium">BPM</th>
                  <th className="px-4 py-3 font-medium">Key</th>
                  <th className="px-4 py-3 font-medium">Circle</th>
                </tr>
              </thead>
              <tbody>
                {demo.map((t, i) => {
                  const above = demo[i - 1];
                  const below = demo[i + 1];

                  const distUp = circularDistance(t.circle, above?.circle);
                  const distDown = circularDistance(t.circle, below?.circle);

                  const upColor = compatibilityColor(distUp);
                  const downColor = compatibilityColor(distDown);

                  const upDir = direction(t.circle, above?.circle); // relative to current row
                  const downDir = direction(t.circle, below?.circle);

                  return (
                    <tr
                      key={t.id}
                      className="border-t border-slate-800 hover:bg-slate-900/60"
                    >
                      <td className="px-4 py-3 text-slate-400">{i + 1}</td>

                      <td className="px-4 py-3">
                        <div className="font-medium">{t.title}</div>
                      </td>

                      <td className="px-4 py-3 text-slate-300">{t.artist ?? "—"}</td>

                      <td className="px-4 py-3 tabular-nums text-slate-200">
                        {t.bpm ?? "—"}
                      </td>

                      <td className="px-4 py-3 text-slate-200">{t.key ?? "—"}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-1 text-xs text-slate-200">
                            {t.circle ?? "—"}
                          </span>

                          <div className="flex items-center gap-2">
                            <Arrow
                              dir={upDir}
                              colorClass={upColor}
                              title={
                                above
                                  ? `Above: distance ${distUp} (circle ${above.circle})`
                                  : "No track above"
                              }
                            />
                            <Arrow
                              dir={downDir}
                              colorClass={downColor}
                              title={
                                below
                                  ? `Below: distance ${distDown} (circle ${below.circle})`
                                  : "No track below"
                              }
                            />
                          </div>

                          <span className="text-xs text-slate-400">
                            {above ? `↑ ${above.key ?? "—"}` : "↑ —"}{" "}
                            <span className="mx-1">•</span>{" "}
                            {below ? `↓ ${below.key ?? "—"}` : "↓ —"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
            Compatibility is currently based on circle distance (0 = green, 1 = lime, 2 = amber, 3+ = red).
            We’ll refine this to include Camelot A/B (major/minor) rules next.
          </div>
        </div>
      </div>
    </main>
  );
}
