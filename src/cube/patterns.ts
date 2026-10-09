import { localPattern, type DirCorner, type PatternId } from "./geometry.ts";

export type Fig =
  | { k: "line"; pts: [number, number][] }
  | { k: "fill"; pts: [number, number][] }
  | { k: "dot"; x: number; y: number; r: number }
  | { k: "text"; text: string; size: number };

const tick: Fig = { k: "line", pts: [[0, 0.7], [0, 0.94]] };

/** 图案画在局部坐标里：右为正 x，上为正 y，范围大约 -1..1。 */
export function patternFigs(id: PatternId): Fig[] {
  switch (id) {
    case "blank":
      return [tick];
    case "arrow":
      return [
        { k: "line", pts: [[0, -0.58], [0, 0.22]] },
        { k: "fill", pts: [[0, 0.8], [-0.34, 0.16], [0.34, 0.16]] },
      ];
    case "diagonal":
      return [
        { k: "line", pts: [[-0.58, -0.58], [0.28, 0.28]] },
        { k: "fill", pts: [[0.66, 0.66], [0.16, 0.4], [0.4, 0.16]] },
      ];
    case "cross":
      return [
        { k: "line", pts: [[-0.58, 0], [0.58, 0]] },
        { k: "line", pts: [[0, -0.58], [0, 0.58]] },
        tick,
      ];
    case "tee":
      return [
        { k: "line", pts: [[-0.52, 0.4], [0.52, 0.4]] },
        { k: "line", pts: [[0, 0.4], [0, -0.58]] },
      ];
    case "triangle":
      return [{ k: "fill", pts: [[0.12, 0.84], [0.84, 0.84], [0.84, 0.12]] }];
    case "shang":
      return [{ k: "text", text: "上", size: 1.05 }];
    case "dot":
      return [{ k: "dot", x: 0, y: 0.36, r: 0.18 }];
  }
}

export const PATTERN_LIST: { id: PatternId; name: string }[] = [
  { id: "blank", name: "空白" },
  { id: "arrow", name: "箭头" },
  { id: "diagonal", name: "对角线" },
  { id: "cross", name: "十字" },
  { id: "tee", name: "T 字" },
  { id: "triangle", name: "三角" },
  { id: "shang", name: "上" },
  { id: "dot", name: "圆点" },
];

/** 阴影三角在 rot=0 时占东北角；顺时针转一档，角也顺时针挪一档。 */
export function shadedCorner(rot: number): DirCorner {
  const seq: DirCorner[] = ["NE", "SE", "SW", "NW"];
  return seq[((rot % 4) + 4) % 4]!;
}

export function rotForCorner(corner: DirCorner): number {
  const seq: DirCorner[] = ["NE", "SE", "SW", "NW"];
  return Math.max(0, seq.indexOf(corner));
}

export const FACE_HEX: Record<string, string> = {
  A: "#e4d2a8",
  B: "#b7cfe0",
  C: "#efc3b8",
  D: "#c5d4b4",
  E: "#e3c39a",
  F: "#c9c4de",
};

export const INK = "#1c2430";
export const SEAL = "#9d3b32";

/** 给 3D 贴图用。字母按格子正向写，图案按 rot 转。 */
export function paintFaceCanvas(
  canvas: HTMLCanvasElement,
  pattern: PatternId,
  rot: number,
  letter: string,
  fill: string,
  selected: boolean,
  bad: boolean,
) {
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, size, size);
  const r = size * 0.08;
  roundRect(ctx, 1, 1, size - 2, size - 2, r);
  ctx.fillStyle = bad ? "#e7b2ae" : fill;
  ctx.fill();
  ctx.lineWidth = selected ? size * 0.045 : size * 0.02;
  ctx.strokeStyle = selected ? SEAL : bad ? "#9d3b32" : "#2a3544";
  ctx.stroke();

  const s = size * 0.34;
  const drawPt = (px: number, py: number) => {
    const { lu, lv } = localPattern(px, py, rot);
    return [size / 2 + lu * s, size / 2 - lv * s] as const;
  };

  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INK;
  ctx.fillStyle = INK;
  ctx.lineWidth = size * 0.045;
  for (const fig of patternFigs(pattern)) {
    if (fig.k === "line") {
      ctx.beginPath();
      fig.pts.forEach(([x, y], i) => {
        const [cx, cy] = drawPt(x, y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.stroke();
    } else if (fig.k === "fill") {
      ctx.beginPath();
      fig.pts.forEach(([x, y], i) => {
        const [cx, cy] = drawPt(x, y);
        if (i === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath();
      ctx.fill();
    } else if (fig.k === "dot") {
      const [cx, cy] = drawPt(fig.x, fig.y);
      ctx.beginPath();
      ctx.arc(cx, cy, fig.r * s, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const [cx, cy] = drawPt(0, 0);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate((rot * Math.PI) / 2);
      ctx.font = `700 ${Math.round(fig.size * s)}px "Noto Serif SC", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(fig.text, 0, fig.size * s * 0.06);
      ctx.restore();
    }
  }

  ctx.fillStyle = "#1c2430";
  ctx.font = `700 ${Math.round(size * 0.16)}px "Noto Sans SC", sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(letter, size * 0.08, size * 0.06);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
