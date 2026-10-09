import { useRef } from "react";
import {
  DIRS,
  oppositePairs,
  vertexGroups,
  type Dir,
  type DirCorner,
  type Face,
  type FaceId,
  type FoldResult,
} from "@/cube/geometry";
import { PatternSvg } from "@/components/pattern-svg";

const PITCH = 92;
const CELL = 78;
const PAD = 28;

const FILL: Record<FaceId, string> = {
  A: "fill-face-a",
  B: "fill-face-b",
  C: "fill-face-c",
  D: "fill-face-d",
  E: "fill-face-e",
  F: "fill-face-f",
};

const MARK = ["甲", "乙", "丙"];

export function NetThumb({
  cells,
  active,
  onClick,
  label,
  passive = false,
}: {
  cells: { x: number; y: number }[];
  active?: boolean;
  onClick?: () => void;
  label: string;
  passive?: boolean;
}) {
  const minX = Math.min(...cells.map((c) => c.x));
  const maxX = Math.max(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxY = Math.max(...cells.map((c) => c.y));
  const u = 14;
  const w = (maxX - minX + 1) * u + 4;
  const h = (maxY - minY + 1) * u + 4;
  const svg = (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      {cells.map((c, i) => (
        <rect
          key={i}
          x={(c.x - minX) * u + 2}
          y={(maxY - c.y) * u + 2}
          width={u - 2}
          height={u - 2}
          rx={2}
          className="fill-primary-soft stroke-primary"
          strokeWidth={1}
        />
      ))}
    </svg>
  );
  if (passive) return <span className="inline-flex">{svg}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={
        "flex h-11 min-w-11 items-center justify-center rounded-lg border px-1 " +
        (active ? "border-primary bg-primary-soft" : "border-line bg-card")
      }
    >
      {svg}
    </button>
  );
}

interface Props {
  faces: Face[];
  fold: FoldResult;
  selected: FaceId | null;
  edge: { id: FaceId; dir: Dir } | null;
  partner: { id: FaceId; dir: Dir } | null;
  vertexKey: string | null;
  ghosts: { x: number; y: number }[];
  showEdgeNo: boolean;
  onSelect: (id: FaceId) => void;
  onEdge: (id: FaceId, dir: Dir) => void;
  onVertex: (key: string) => void;
  onMove: (id: FaceId, x: number, y: number) => void;
  moveEnabled: boolean;
}

export function NetBoard(props: Props) {
  const {
    faces,
    fold,
    selected,
    edge,
    partner,
    vertexKey,
    ghosts,
    showEdgeNo,
    onSelect,
    onEdge,
    onVertex,
    onMove,
    moveEnabled,
  } = props;
  const drag = useRef<{ id: FaceId; x: number; y: number } | null>(null);
  const pts = [
    ...faces.map((f) => ({ x: f.x, y: f.y })),
    ...ghosts,
  ];
  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));
  const width = (maxX - minX + 1) * PITCH + PAD * 2;
  const height = (maxY - minY + 1) * PITCH + PAD * 2;
  const origin = (x: number, y: number) => ({
    x: PAD + (x - minX) * PITCH,
    y: PAD + (maxY - y) * PITCH,
  });

  const pairs = oppositePairs(fold);
  const pairOf = (id: FaceId) => pairs.findIndex((p) => p.a === id || p.b === id);
  const groups = vertexGroups(fold);
  const activeGroup = groups.find((g) => g.key === vertexKey) ?? null;

  const occupied = new Set(faces.map((f) => `${f.x},${f.y}`));

  return (
    <div className="scroll-thin h-full overflow-auto rounded-card border border-line bg-card">
      <svg
        width="100%"
        viewBox={`0 0 ${width} ${height}`}
        className="mx-auto block max-w-full touch-none"
        role="img"
        aria-label="正方体展开图"
      >
        {ghosts.map((g) => {
          if (occupied.has(`${g.x},${g.y}`)) return null;
          const o = origin(g.x, g.y);
          return (
            <rect
              key={`${g.x},${g.y}`}
              x={o.x + 6}
              y={o.y + 6}
              width={CELL}
              height={CELL}
              rx={10}
              className="cursor-pointer fill-primary-soft stroke-primary"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              onPointerDown={(e) => {
                e.stopPropagation();
                if (selected) onMove(selected, g.x, g.y);
              }}
            />
          );
        })}
        {selected &&
          pairs
            .filter((p) => p.a === selected || p.b === selected)
            .map((p) => {
              const A = faces.find((f) => f.id === p.a)!;
              const B = faces.find((f) => f.id === p.b)!;
              const a = origin(A.x, A.y);
              const b = origin(B.x, B.y);
              return (
                <line
                  key={p.a + p.b}
                  x1={a.x + CELL / 2 + 6}
                  y1={a.y + CELL / 2 + 6}
                  x2={b.x + CELL / 2 + 6}
                  y2={b.y + CELL / 2 + 6}
                  className="stroke-seal"
                  strokeDasharray="4 5"
                  strokeWidth={1.5}
                />
              );
            })}
        {faces.map((f) => {
          const o = origin(f.x, f.y);
          const pi = pairOf(f.id);
          const on = f.id === selected || (selected !== null && pairs.some((p) => (p.a === selected && p.b === f.id) || (p.b === selected && p.a === f.id)));
          return (
            <g key={f.id} transform={`translate(${o.x + 6} ${o.y + 6})`}>
              <rect
                data-face={f.id}
                width={CELL}
                height={CELL}
                rx={10}
                className={`cursor-pointer ${FILL[f.id]} ${on ? "stroke-seal" : "stroke-ink"}`}
                strokeWidth={on ? 3 : 1.6}
                strokeDasharray={on && f.id !== selected ? "6 4" : undefined}
                onPointerDown={(e) => {
                  drag.current = { id: f.id, x: e.clientX, y: e.clientY };
                  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                }}
                onPointerUp={(e) => {
                  const d = drag.current;
                  drag.current = null;
                  if (!d || d.id !== f.id) return;
                  const dx = e.clientX - d.x;
                  const dy = e.clientY - d.y;
                  if (moveEnabled && Math.hypot(dx, dy) > 18) {
                    const horizontal = Math.abs(dx) > Math.abs(dy);
                    const tx = f.x + (horizontal ? (dx > 0 ? 1 : -1) : 0);
                    const ty = f.y + (horizontal ? 0 : dy > 0 ? -1 : 1);
                    onMove(f.id, tx, ty);
                  } else {
                    onSelect(f.id);
                  }
                }}
              />
              <text x={8} y={20} className="fill-ink text-sm font-bold" fontSize={16} fontWeight={700} style={{ pointerEvents: "none" }}>
                {f.id}
              </text>
              {pi >= 0 && (
                <text x={CELL - 8} y={20} textAnchor="end" className="fill-muted" fontSize={12} style={{ pointerEvents: "none" }}>
                  {MARK[pi]}
                </text>
              )}
              <g transform={`translate(${CELL / 2} ${CELL / 2 + 6})`} style={{ pointerEvents: "none" }}>
                <PatternSvg pattern={f.pattern} rot={f.rot} s={24} />
              </g>
              {DIRS.map((d) => {
                const hot = edgeHit(d.name, CELL);
                const active =
                  (edge?.id === f.id && edge.dir === d.name) ||
                  (partner?.id === f.id && partner.dir === d.name);
                return (
                  <g key={d.name}>
                    <line
                      x1={hot.x1}
                      y1={hot.y1}
                      x2={hot.x2}
                      y2={hot.y2}
                      stroke={active ? "var(--color-seal)" : "transparent"}
                      strokeWidth={active ? 5 : 12}
                      strokeLinecap="round"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onEdge(f.id, d.name);
                      }}
                    />
                    {showEdgeNo && (
                      <text
                        x={hot.lx}
                        y={hot.ly}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={11}
                        className="fill-muted"
                        style={{ pointerEvents: "none" }}
                      >
                        {d.num}
                      </text>
                    )}
                  </g>
                );
              })}
              {(["NE", "NW", "SE", "SW"] as DirCorner[]).map((corner) => {
                const p = cornerPos(corner, CELL);
                const hit = activeGroup?.corners.some((c) => c.id === f.id && c.corner === corner);
                const g = groups.find((group) => group.corners.some((c) => c.id === f.id && c.corner === corner));
                return (
                  <circle
                    key={corner}
                    cx={p.x}
                    cy={p.y}
                    r={hit ? 7 : 5}
                    className={hit ? "fill-seal stroke-card" : "fill-card stroke-ink"}
                    strokeWidth={1.5}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (g) onVertex(g.key);
                    }}
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function edgeHit(dir: Dir, size: number) {
  const m = 8;
  if (dir === "N") return { x1: m, y1: 3, x2: size - m, y2: 3, lx: size / 2, ly: 14 };
  if (dir === "S") return { x1: m, y1: size - 3, x2: size - m, y2: size - 3, lx: size / 2, ly: size - 14 };
  if (dir === "E") return { x1: size - 3, y1: m, x2: size - 3, y2: size - m, lx: size - 14, ly: size / 2 };
  return { x1: 3, y1: m, x2: 3, y2: size - m, lx: 14, ly: size / 2 };
}

function cornerPos(corner: DirCorner, size: number) {
  const o = 5;
  if (corner === "NE") return { x: size - o, y: o };
  if (corner === "NW") return { x: o, y: o };
  if (corner === "SE") return { x: size - o, y: size - o };
  return { x: o, y: size - o };
}
