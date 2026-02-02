"use client";

type Track = {
  id: string;
  title: string;
  artist?: string;
  bpm?: number;
  key?: string; // e.g. "8A"
  circle?: number; // 1–12
  system?: "camelot";
};

type Camelot = { n: number; l: "A" | "B" };

const demo: Track[] = [
  { id: "1", title: "Track One", artist: "DJ Example", bpm: 64, key: "8A", circle: 8, system: "camelot" },
  { id: "2", title: "Track Two", artist: "DJ Example", bpm: 66, key: "9A", circle: 9, system: "camelot" },
  { id: "3", title: "Track Three", artist: "DJ Example", bpm: 63, key: "9B", circle: 9, system: "camelot" },
  { id: "4", title: "Track Four", artist: "DJ Example", bpm: 65, key: "10B", circle: 10, system: "camelot" },
  { id: "5", title: "Track Five", artist: "DJ Example", bpm: 62, key: "10A", circle: 10, system: "camelot" },
];

function parseCamelot(key?: string): Camelot | undefined {
  if (!key) return undefined;
  const m = key.trim().toUpperCase().match(/^([1-9]|1[0-2])([AB])$/);
  if (!m) return undefined;
  return { n: Number(m[1]), l: m[2] as "A" | "B" };
}

function circularDistance(a: number, b: number, mod = 12): number {
  const d = Math.abs(a - b) % mod;
  return Math.min(d, mod - d);
}

function circleMove(from: number, to: number, mod = 12): { steps: number; dir: "up" | "down" } {
  // "up" means + direction around the circle; "down" means - direction.
  const up = (to - from + mod) % mod;
  const down = (from - to + mod) % mod;
  if (up <= down) return { steps: up, dir: "up" };
  return { steps: down, dir: "down" };
}

function camelotDistance(a?: string, b?: string): number | undefined {
  const A = parseCamelot(a);
  const B = parseCamelot(b);
  if (!A || !B) return undefined;

  const num = circularDistance(A.n, B.n, 12);

  // Simple rule:
  // same number diff letter = 1
  // same letter = numeric distance
  // diff letter diff number = numeric distance + 1 (a “penalty”)
  if (A.n === B.n && A.l !== B.l) return 1;
  if (A.l === B.l) return num;
  return num + 1;
}

function compatColor(distance: number | undefined): string {
  if (distance === undefined) return "text-slate-500";
  if (distance === 0) return "text-green-400";
  if (distance === 1) return "text-lime-400";
  if (distance === 2) return "text-yellow-300";
  if (distance === 3) return "text-orange-300";
  return "text-red-300";
}

function Arrow({
  dir,
  colorClass,
  title,
}: {
  dir: "up" | "down";
  colorClass: string;
  title: string;
}) {
  return (
    <span className={`inline-flex items-center justify-center ${colorClass}`} title={title} aria-label={title}>
      {dir === "up" ? "↑" : "↓"}
    </span>
  );
}

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <h1 className="text-3xl font-semibold">Rich Teaches Music</h1>
      <p className="text-slate-300 mt-2">Music theory, taught while music is happening.</p>

      <div className="mt-8 overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-900/60 text-slate-200">
            <tr>
              <th className="px-4 py-3 w-12">#</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Artist</th>
              <th className="px-4 py-3">BPM</th>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Circle</th>
              <th className="px-4 py-3">Compat (Above/Below)</th>
            </tr>
          </thead>

          <tbody>
            {demo.map((t, i) => {
              const above = i > 0 ? demo[i - 1] : undefined;
              const below = i < demo.length - 1 ? demo[i + 1] : undefined;

              const upDist = camelotDistance(t.key, above?.key);
              const downDist = camelotDistance(t.key, below?.key);

              const upColor = compatColor(upDist);
              const downColor = compatColor(downDist);

              // Move direction (based on Camelot number if possible, otherwise circle if present)
              const tC = parseCamelot(t.key);
              const aC = parseCamelot(above?.key);
              const bC = parseCamelot(below?.key);

              const upMove =
                tC && aC ? circleMove(tC.n, aC.n).steps : t.circle && above?.circle ? circleMove(t.circle, above.circle).steps : 0;
              const downMove =
                tC && bC ? circleMove(tC.n, bC.n).steps : t.circle && below?.circle ? circleMove(t.circle, below.circle).steps : 0;

              const upDir = tC && aC ? circleMove(tC.n, aC.n).dir : "up";
              const downDir = tC && bC ? circleMove(tC.n, bC.n).dir : "down";

              return (
                <tr key={t.id} className="border-t border-slate-800 hover:bg-slate-900/40">
                  <td className="px-4 py-3 text-slate-400">{i + 1}</td>

                  <td className="px-4 py-3">
                    <div className="font-medium">{t.title}</div>
                  </td>

                  <td className="px-4 py-3 text-slate-300">{t.artist ?? "—"}</td>

                  <td className="px-4 py-3 tabular-nums text-slate-200">{t.bpm ?? "—"}</td>

                  <td className="px-4 py-3 text-slate-200">{t.key ?? "—"}</td>

                  <td className="px-4 py-3 text-slate-200 tabular-nums">{t.circle ?? "—"}</td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums text-slate-200">{t.circle ?? "—"}</span>

                      <div className="flex items-center gap-2">
                        <Arrow
                          dir={upDir}
                          colorClass={upColor}
                          title={above ? `Above: ${upMove} (${above.key ?? "—"})` : "No track above"}
                        />
                        <Arrow
                          dir={downDir}
                          colorClass={downColor}
                          title={below ? `Below: ${downMove} (${below.key ?? "—"})` : "No track below"}
                        />
                      </div>

                      <span className="text-xs text-slate-400">
                        {above ? `↑ ${above.key ?? "—"}` : "↑ —"} <span className="mx-1">|</span>{" "}
                        {below ? `↓ ${below.key ?? "—"}` : "↓ —"}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-400">
          Compatibility is currently based on simple Camelot distance. We’ll refine this with stricter Camelot A/B rules next.
        </div>
      </div>
    </main>
  );
}