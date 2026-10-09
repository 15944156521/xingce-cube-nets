import {
  cameraFrame,
  foldFaces,
  localPattern,
  onFace,
  projectVec,
  projectView,
  type Face,
  type PlacedFace,
  type Vec,
} from "@/cube/geometry";
import { patternFigs } from "@/cube/patterns";

const SHADES = ["#f7f1e6", "#efe4d2", "#e4d8c4"];

/** 行测选项用的等角小立方：不标字母，只画图案。 */
export function MiniCube({
  faces,
  view,
  mirror = false,
}: {
  faces: Face[];
  view: Vec;
  mirror?: boolean;
}) {
  const fold = foldFaces(faces);
  if (!fold.valid) {
    return <p className="px-2 text-sm text-seal">这张图折不成正方体</p>;
  }
  const frame = cameraFrame(view);
  const viewProj = projectView(fold, view);
  const polys = viewProj.faces.map((f) => {
    const placed = fold.byId.get(f.id)!;
    return {
      id: f.id,
      poly: f.polygon,
      placed,
      pattern: f.pattern,
      rot: f.rot,
    };
  });
  const all = polys.flatMap((p) => p.poly);
  const map = fit(all);

  return (
    <svg viewBox="0 0 160 140" className="h-36 w-full" aria-hidden>
      {polys.map((f, i) => (
        <g key={f.id}>
          <polygon
            points={f.poly.map((p) => {
              const q = map(p);
              return `${q.x},${q.y}`;
            }).join(" ")}
            fill={SHADES[i % SHADES.length]}
            stroke="#1c2430"
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
          {patternFigs(f.pattern).map((fig, k) => drawFig(fig, k, f, map, frame, mirror))}
        </g>
      ))}
    </svg>
  );
}

function drawFig(
  fig: ReturnType<typeof patternFigs>[number],
  key: number,
  face: { placed: PlacedFace; rot: number },
  map: (p: { x: number; y: number }) => { x: number; y: number },
  frame: ReturnType<typeof cameraFrame>,
  mirror: boolean,
) {
  const to = (px: number, py: number) => {
    const { lu, lv } = localPattern(px, py, face.rot, mirror);
    return map(projectVec(onFace(face.placed, lu, lv), frame));
  };
  if (fig.k === "line") {
    return (
      <polyline
        key={key}
        points={fig.pts.map(([x, y]) => {
          const p = to(x, y);
          return `${p.x},${p.y}`;
        }).join(" ")}
        fill="none"
        stroke="#1c2430"
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    );
  }
  if (fig.k === "fill") {
    return (
      <polygon
        key={key}
        points={fig.pts.map(([x, y]) => {
          const p = to(x, y);
          return `${p.x},${p.y}`;
        }).join(" ")}
        fill="#1c2430"
      />
    );
  }
  if (fig.k === "dot") {
    const c = to(fig.x, fig.y);
    const e = to(fig.x + fig.r, fig.y);
    const r = Math.hypot(e.x - c.x, e.y - c.y);
    return <circle key={key} cx={c.x} cy={c.y} r={r} fill="#1c2430" />;
  }
  const c = to(0, 0);
  const up = to(0, 0.45);
  const ang = (Math.atan2(up.y - c.y, up.x - c.x) * 180) / Math.PI + 90;
  return (
    <text
      key={key}
      x={c.x}
      y={c.y}
      textAnchor="middle"
      dominantBaseline="middle"
      fontSize={16}
      fontFamily="var(--font-serif), serif"
      fontWeight={700}
      fill="#1c2430"
      transform={`rotate(${ang} ${c.x} ${c.y})`}
    >
      {fig.text}
    </text>
  );
}

function fit(points: { x: number; y: number }[]) {
  const screen = points.map((p) => ({ x: p.x, y: -p.y }));
  const minX = Math.min(...screen.map((p) => p.x));
  const maxX = Math.max(...screen.map((p) => p.x));
  const minY = Math.min(...screen.map((p) => p.y));
  const maxY = Math.max(...screen.map((p) => p.y));
  const pad = 16;
  const s = Math.min(128 / (maxX - minX || 1), 108 / (maxY - minY || 1));
  const ox = pad + (128 - (maxX - minX) * s) / 2 - minX * s;
  const oy = pad + (108 - (maxY - minY) * s) / 2 - minY * s;
  return (p: { x: number; y: number }) => ({ x: ox + p.x * s, y: oy + -p.y * s });
}
