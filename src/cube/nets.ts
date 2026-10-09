import { foldFaces, labelCells, type Face, type FaceId } from "./geometry.ts";

export type Family = "141" | "132" | "222" | "33" | "bad";

export interface NetDef {
  id: string;
  name: string;
  family: Family;
  /** 课上的一句话，说明这一变体怎么认。 */
  blurb: string;
  cells: { x: number; y: number }[];
}

export const NETS: NetDef[] = [
  {
    id: "141-11",
    name: "141 · 同列两端",
    family: "141",
    blurb: "四连的第一列上下各一面。这两面同列隔一面，是相对面。",
    cells: [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 0, y: -1 },
    ],
  },
  {
    id: "141-12",
    name: "141 · 隔一列",
    family: "141",
    blurb: "上在第一列、下在第二列。上下两面构成 Z 字两端，相对。",
    cells: [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 1, y: -1 },
    ],
  },
  {
    id: "141-13",
    name: "141 · 隔两列",
    family: "141",
    blurb: "上在第一列、下在第三列。它们不共边，折完是相对面，但不能用「隔一个」直接看。",
    cells: [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 2, y: -1 },
    ],
  },
  {
    id: "141-14",
    name: "141 · 异侧两端",
    family: "141",
    blurb: "上下贴在四连的两头，但是分居两侧。这样合法。若改成同一侧，就会叠成一个面。",
    cells: [
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: -1 },
    ],
  },
  {
    id: "141-22",
    name: "141 · 十字",
    family: "141",
    blurb: "上下都在第二列。三对相对面全是「同行或同列隔一面」，最适合入门。",
    cells: [
      { x: 1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 1, y: -1 },
    ],
  },
  {
    id: "141-23",
    name: "141 · 邻列",
    family: "141",
    blurb: "上在第二列、下在第三列。四连里隔一个的仍相对，上下两面走 Z 字。",
    cells: [
      { x: 1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 2, y: -1 },
    ],
  },
  {
    id: "231-straight",
    name: "132/231 · 直二",
    family: "132",
    blurb: "中间三连，一侧两个拉直，另一侧一个。从「1」那头读是 132，从「2」那头读是 231。",
    cells: [
      { x: 1, y: 3 },
      { x: 1, y: 2 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 0 },
    ],
  },
  {
    id: "231-step",
    name: "132/231 · 台阶",
    family: "132",
    blurb: "三连的一侧伸出两个台阶，另一侧一个。一二隔河，只有一个和三连共边。",
    cells: [
      { x: 0, y: 2 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  },
  {
    id: "231-side",
    name: "132/231 · 侧二",
    family: "132",
    blurb: "两个在三连的斜上方，一个在另一侧。三种 132/231 的差别只在「2」相对「1」的位置。",
    cells: [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 2, y: 0 },
    ],
  },
  {
    id: "222",
    name: "222 · 阶梯",
    family: "222",
    blurb: "每行两个，错成阶梯。没有「隔一个」的直线，三对相对面全是 Z 字两端。",
    cells: [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  },
  {
    id: "33",
    name: "33 · 日字错开",
    family: "33",
    blurb: "两个三连只靠一条边接上，像错开的「日」。整块 2×3 的「日」不能折。",
    cells: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ],
  },
  {
    id: "bad-tian",
    name: "非法 · 田字",
    family: "bad",
    blurb: "含有 2×2 的田字。折的时候有两个面落到同一位置。",
    cells: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  },
  {
    id: "bad-ri",
    name: "非法 · 日字",
    family: "bad",
    blurb: "2×3 的「日」字整块。口诀「两个三，日相连」指的是错开相接，不是这种实心长方。",
    cells: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
  },
  {
    id: "bad-ao",
    name: "非法 · 凹字",
    family: "bad",
    blurb: "凹字两侧会折到同一个面，重叠。看到凹，直接判不能折。",
    cells: [
      { x: 0, y: 1 },
      { x: 2, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 1, y: -1 },
    ],
  },
  {
    id: "bad-same",
    name: "非法 · 同侧两端",
    family: "bad",
    blurb: "141 的两个侧边贴在四连两头、而且在同一侧。两个都要去当顶面，重叠。",
    cells: [
      { x: 0, y: 1 },
      { x: 3, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
  },
  {
    id: "bad-corner",
    name: "非法 · 对角粘连",
    family: "bad",
    blurb: "只在顶点碰到，没有公共边。展开图必须边边相连，这样是悬空。",
    cells: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: -1 },
      { x: 2, y: -1 },
      { x: 3, y: -1 },
    ],
  },
];

export function netById(id: string): NetDef {
  return NETS.find((n) => n.id === id) ?? NETS[4]!;
}

export function loadNet(id: string): Face[] {
  return labelCells(netById(id).cells);
}

export interface DemoScript {
  id: string;
  title: string;
  netId: string;
  steps: { face: FaceId; x: number; y: number; say: string }[];
}

export const DEMOS: DemoScript[] = [
  {
    id: "141-to-132",
    title: "141 移成 132",
    netId: "141-22",
    steps: [
      {
        face: "A",
        x: 2,
        y: 1,
        say: "先把顶面 A 沿棱滚到旁边。还是 141，相对面没有变。",
      },
      {
        face: "B",
        x: 0,
        y: -1,
        say: "再把 B 滚下来，四连被拆开，变成 132/231。A-F、B-D、C-E 仍然相对。",
      },
    ],
  },
  {
    id: "222-to-row",
    title: "231 式阶梯滚出隔一面",
    netId: "222",
    steps: [
      {
        face: "A",
        x: 0,
        y: 1,
        say: "阶梯上的 A 滚到侧面后，A 与 D 变成「同行隔一面」。相对的还是这一对，只是更好认了。",
      },
    ],
  },
];

function longest(pts: { x: number; y: number }[]) {
  let best = 1;
  for (const p of pts) {
    let h = 1;
    for (let x = p.x + 1; pts.some((q) => q.x === x && q.y === p.y); x++) h++;
    let v = 1;
    for (let y = p.y + 1; pts.some((q) => q.x === p.x && q.y === y); y++) v++;
    best = Math.max(best, h, v);
  }
  return best;
}

function hasBlock(pts: { x: number; y: number }[], w: number, h: number) {
  return pts.some((p) => {
    for (let dx = 0; dx < w; dx++) {
      for (let dy = 0; dy < h; dy++) {
        if (!pts.some((q) => q.x === p.x + dx && q.y === p.y + dy)) return false;
      }
    }
    return true;
  });
}

/** 两个同向的直三连，不重叠，合起来正好六个面。十字这种横竖各一截不算。 */
function isParallel33(pts: { x: number; y: number }[]) {
  const lines: string[][] = [];
  for (const p of pts) {
    if ([0, 1, 2].every((i) => pts.some((q) => q.x === p.x + i && q.y === p.y))) {
      lines.push([0, 1, 2].map((i) => `h:${p.x + i},${p.y}`));
    }
    if ([0, 1, 2].every((i) => pts.some((q) => q.x === p.x && q.y === p.y + i))) {
      lines.push([0, 1, 2].map((i) => `v:${p.x},${p.y + i}`));
    }
  }
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i]!;
      const b = lines[j]!;
      const sameWay = a[0]!.startsWith("h") === b[0]!.startsWith("h");
      if (!sameWay) continue;
      const set = new Set(a);
      if (b.some((c) => set.has(c))) continue;
      if (set.size + b.length === 6) return true;
    }
  }
  return false;
}

/** 移块之后重新报类型。非法图会指出是田、日、凹、悬空还是普通重叠。 */
export function describeShape(faces: Face[]): { family: Family; title: string; detail: string } {
  const fold = foldFaces(faces);
  const pts = faces.map((f) => ({ x: f.x, y: f.y }));
  if (!fold.valid) {
    if (fold.disconnected.length) {
      return { family: "bad", title: "非法 · 悬空或对角", detail: fold.reason };
    }
    if (hasBlock(pts, 3, 2) || hasBlock(pts, 2, 3)) {
      return { family: "bad", title: "非法 · 日字整块", detail: fold.reason };
    }
    if (hasBlock(pts, 2, 2)) {
      return { family: "bad", title: "非法 · 含田字", detail: fold.reason };
    }
    return { family: "bad", title: "非法 · 折后重叠", detail: fold.reason };
  }
  const run = longest(pts);
  if (run >= 4) return { family: "141", title: "141 型", detail: "最长带是四连，两侧各一个面。" };
  if (run <= 2) return { family: "222", title: "222 型", detail: "没有三连，是阶梯。相对面看 Z 字两端。" };
  if (isParallel33(pts)) return { family: "33", title: "33 型", detail: "两个三连只错开相接。" };
  return {
    family: "132",
    title: "132 / 231 型",
    detail: "最长带是三连，两侧是 1 个和 2 个。从另一头读就是 231。",
  };
}
