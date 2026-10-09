/**
 * 正方体展开图的几何判定。
 * 网格：x 向东，y 向北。折叠时纸面向外，基底满足 u × v = 外法向 n。
 * 真相一律以折叠后的三维坐标为准；口诀函数只负责「用哪条规则解释」。
 */

export type FaceId = "A" | "B" | "C" | "D" | "E" | "F";
export type Dir = "N" | "E" | "S" | "W";
export type PatternId =
  | "blank"
  | "arrow"
  | "diagonal"
  | "cross"
  | "tee"
  | "triangle"
  | "shang"
  | "dot";

export interface Face {
  id: FaceId;
  x: number;
  y: number;
  pattern: PatternId;
  rot: number;
}

export type Vec = [number, number, number];

export interface Basis {
  u: Vec;
  v: Vec;
  n: Vec;
}

export interface PlacedFace extends Face {
  basis: Basis;
  center: Vec;
}

export interface FoldResult {
  valid: boolean;
  reason: string;
  placed: PlacedFace[];
  byId: Map<FaceId, PlacedFace>;
  /** 折叠父面，以及从父面走向该面的网格方向。根为 null。 */
  parent: Map<FaceId, { id: FaceId; dir: Dir } | null>;
  order: FaceId[];
  collisions: FaceId[];
  disconnected: FaceId[];
}

export const FACE_IDS: FaceId[] = ["A", "B", "C", "D", "E", "F"];

export const DIRS: { name: Dir; dx: number; dy: number; label: string; num: number }[] = [
  { name: "N", dx: 0, dy: 1, label: "北", num: 1 },
  { name: "E", dx: 1, dy: 0, label: "东", num: 2 },
  { name: "S", dx: 0, dy: -1, label: "南", num: 3 },
  { name: "W", dx: -1, dy: 0, label: "西", num: 4 },
];

const OPP: Record<Dir, Dir> = { N: "S", S: "N", E: "W", W: "E" };

export function dirMeta(dir: Dir) {
  return DIRS.find((d) => d.name === dir)!;
}

export function edgeCode(id: FaceId, dir: Dir): string {
  return `${id}${dirMeta(dir).num}`;
}

export function add(a: Vec, b: Vec): Vec {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}
export function sub(a: Vec, b: Vec): Vec {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
export function scale(a: Vec, s: number): Vec {
  return [a[0] * s, a[1] * s, a[2] * s];
}
export function dot(a: Vec, b: Vec): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: Vec, b: Vec): Vec {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function neg(a: Vec): Vec {
  return [-a[0], -a[1], -a[2]];
}
export function vecEq(a: Vec, b: Vec, eps = 1e-6): boolean {
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps && Math.abs(a[2] - b[2]) < eps;
}
export function normalize(a: Vec): Vec {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
export function keyOf(v: Vec): string {
  return v.map((n) => Math.round(n * 2) / 2).join(",");
}

/** 绕已有基底滚过一条棱。右手系，折向立方体外侧。 */
export function roll(b: Basis, dir: Dir): Basis {
  const { u, v, n } = b;
  switch (dir) {
    case "E":
      return { u: cross(v, u), v, n: cross(v, n) };
    case "W":
      return { u: cross(u, v), v, n: cross(n, v) };
    case "N":
      return { u, v: cross(v, u), n: cross(n, u) };
    case "S":
      return { u, v: cross(u, v), n: cross(u, n) };
  }
}

function axisKey(v: Vec): string {
  return keyOf(v);
}

/**
 * 把展开图折到立方体上。
 * 根面外法向 +Z，网格东 = +X，网格北 = +Y。
 * 两个格子折到同一法向，或绕圈后法向不一致，都算重叠。
 */
export function foldFaces(faces: Face[]): FoldResult {
  const byPos = new Map<string, Face>();
  for (const f of faces) byPos.set(`${f.x},${f.y}`, f);

  const empty: FoldResult = {
    valid: false,
    reason: "没有面",
    placed: [],
    byId: new Map(),
    parent: new Map(),
    order: [],
    collisions: [],
    disconnected: [],
  };
  if (faces.length === 0) return empty;

  const root = chooseRoot(faces);
  const basis0: Basis = { u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1] };
  const byId = new Map<FaceId, PlacedFace>();
  const parent = new Map<FaceId, { id: FaceId; dir: Dir } | null>();
  const order: FaceId[] = [];
  const collisions = new Set<FaceId>();
  const normalOwner = new Map<string, FaceId>();

  const rootPlaced: PlacedFace = { ...root, basis: basis0, center: [...basis0.n] };
  byId.set(root.id, rootPlaced);
  parent.set(root.id, null);
  order.push(root.id);
  normalOwner.set(axisKey(basis0.n), root.id);

  const queue = [root];
  while (queue.length) {
    const cur = queue.shift()!;
    const pb = byId.get(cur.id)!;
    for (const d of DIRS) {
      const nb = byPos.get(`${cur.x + d.dx},${cur.y + d.dy}`);
      if (!nb) continue;
      const b2 = roll(pb.basis, d.name);
      if (byId.has(nb.id)) {
        const exist = byId.get(nb.id)!;
        if (!vecEq(exist.basis.n, b2.n)) {
          collisions.add(nb.id);
          collisions.add(cur.id);
        }
        continue;
      }
      const ak = axisKey(b2.n);
      const owner = normalOwner.get(ak);
      if (owner) {
        collisions.add(nb.id);
        collisions.add(owner);
      } else {
        normalOwner.set(ak, nb.id);
      }
      byId.set(nb.id, { ...nb, basis: b2, center: [...b2.n] });
      parent.set(nb.id, { id: cur.id, dir: d.name });
      order.push(nb.id);
      queue.push(nb);
    }
  }

  const disconnected = faces.filter((f) => !byId.has(f.id)).map((f) => f.id);
  const placed = order.map((id) => byId.get(id)!).filter(Boolean);

  let reason = "";
  let valid = false;
  if (faces.length !== 6) {
    reason = `展开图有 ${faces.length} 个面，正方体必须是 6 个面。`;
  } else if (disconnected.length) {
    reason = "不合法：有面只在顶点相接或完全分开（悬空），不能折成封闭正方体。";
  } else if (collisions.size) {
    reason = "不合法，无法折成无重叠正方体。存在面折到同一位置（田字、凹字、日字或同侧叠面都会这样）。";
  } else if (normalOwner.size !== 6) {
    reason = "不合法，无法折成无重叠正方体。";
  } else {
    valid = true;
    reason = "合法展开图，可以折成无重叠的正方体。";
  }

  return {
    valid,
    reason,
    placed,
    byId,
    parent,
    order,
    collisions: [...collisions],
    disconnected,
  };
}

function chooseRoot(faces: Face[]): Face {
  const cx = faces.reduce((s, f) => s + f.x, 0) / faces.length;
  const cy = faces.reduce((s, f) => s + f.y, 0) / faces.length;
  return [...faces].sort((a, b) => {
    const da = (a.x - cx) ** 2 + (a.y - cy) ** 2;
    const db = (b.x - cx) ** 2 + (b.y - cy) ** 2;
    return da - db || b.y - a.y || a.x - b.x || a.id.charCodeAt(0) - b.id.charCodeAt(0);
  })[0]!;
}

/** 图案在面上的右、上方向（从外部看，rot 为顺时针四分之一圈）。 */
export function patternAxes(basis: Basis, rot: number): { right: Vec; up: Vec } {
  const r = ((rot % 4) + 4) % 4;
  const { u, v } = basis;
  const ups: Vec[] = [v, u, neg(v), neg(u)];
  const rights: Vec[] = [u, neg(v), neg(u), v];
  return { right: rights[r]!, up: ups[r]! };
}

/** 把图案局部坐标（右 +x、上 +y，范围约 -1..1）变到该面的三维点。 */
export function patternPoint(face: PlacedFace, px: number, py: number, out = 1): Vec {
  const { right, up } = patternAxes(face.basis, face.rot);
  return add(add(scale(face.center, out), scale(right, px)), scale(up, py));
}

export interface OppositePair {
  a: FaceId;
  b: FaceId;
  rule: "row" | "col" | "z" | "fold";
  text: string;
}

/** 相对面：外法向互为相反数。非法展开返回空。 */
export function oppositePairs(fold: FoldResult): OppositePair[] {
  if (!fold.valid) return [];
  const list = fold.placed;
  const pairs: OppositePair[] = [];
  const used = new Set<FaceId>();
  for (const f of list) {
    if (used.has(f.id)) continue;
    const other = list.find((g) => g.id !== f.id && vecEq(g.basis.n, neg(f.basis.n)));
    if (!other) continue;
    used.add(f.id);
    used.add(other.id);
    const [a, b] = f.id < other.id ? [f, other] : [other, f];
    const rule = classifyOppositeRule(a, b, list);
    pairs.push({
      a: a.id,
      b: b.id,
      rule: rule.kind,
      text: `${a.id} 与 ${b.id} 相对：${rule.text}`,
    });
  }
  return pairs.sort((p, q) => p.a.localeCompare(q.a));
}

export function oppositeOf(fold: FoldResult, id: FaceId): OppositePair | null {
  return oppositePairs(fold).find((p) => p.a === id || p.b === id) ?? null;
}

/**
 * 相对面口诀，只解释已经由三维确认的那一对。
 * a. 同行或同列，中间正好隔一个面；
 * b. Z / S 及其旋转的两端；
 * c. 其余：折起后不相邻，只能是相对。
 */
export function classifyOppositeRule(
  a: Face,
  b: Face,
  all: Face[],
): { kind: "row" | "col" | "z" | "fold"; text: string } {
  const between = (p: Face, q: Face) => {
    if (p.y === q.y && Math.abs(p.x - q.x) === 2) {
      const x = (p.x + q.x) / 2;
      return all.some((f) => f.y === p.y && f.x === x);
    }
    return false;
  };
  if (a.y === b.y && between(a, b)) {
    return { kind: "row", text: "同行隔一面。" };
  }
  if (a.x === b.x && Math.abs(a.y - b.y) === 2 && all.some((f) => f.x === a.x && f.y === (a.y + b.y) / 2)) {
    return { kind: "col", text: "同列隔一面。" };
  }
  if (isZEnds(a, b, all)) {
    return { kind: "z", text: "Z 字两端相对（含 S 形与旋转）。" };
  }
  return { kind: "fold", text: "折起后不相邻，故为相对面。相对面在展开图上绝不会共边。" };
}

/** Z 字（含镜像 S、旋转）四个格子都在，且这两面是两端。 */
export function isZEnds(a: Face, b: Face, all: Face[]): boolean {
  const has = (x: number, y: number) => all.some((f) => f.x === x && f.y === y);
  const ends: [number, number][] = [
    [2, -1],
    [2, 1],
    [-2, -1],
    [-2, 1],
    [1, 2],
    [1, -2],
    [-1, 2],
    [-1, -2],
  ];
  for (const [dx, dy] of ends) {
    if (b.x - a.x !== dx || b.y - a.y !== dy) continue;
    if (Math.abs(dx) === 2) {
      const sx = Math.sign(dx);
      const sy = Math.sign(dy);
      // 两种拐法：先横再竖，中间两格为 (a.x+sx, a.y) 与 (a.x+sx, a.y+sy)
      if (has(a.x + sx, a.y) && has(a.x + sx, a.y + sy)) return true;
    } else {
      const sy = Math.sign(dy);
      const sx = Math.sign(dx);
      if (has(a.x, a.y + sy) && has(a.x + sx, a.y + sy)) return true;
    }
  }
  return false;
}

export interface EdgeRef {
  id: FaceId;
  dir: Dir;
}

export interface EdgeGeom {
  ref: EdgeRef;
  midpoint: Vec;
  along: Vec;
}

/** 面上某一侧棱的中点与走向。 */
export function edgeGeom(face: PlacedFace, dir: Dir): EdgeGeom {
  const { u, v, n } = face.basis;
  let midpoint: Vec;
  let along: Vec;
  switch (dir) {
    case "E":
      midpoint = add(n, u);
      along = v;
      break;
    case "W":
      midpoint = sub(n, u);
      along = v;
      break;
    case "N":
      midpoint = add(n, v);
      along = u;
      break;
    default:
      midpoint = sub(n, v);
      along = u;
  }
  return { ref: { id: face.id, dir }, midpoint, along };
}

export function allEdges(fold: FoldResult): EdgeGeom[] {
  const out: EdgeGeom[] = [];
  for (const f of fold.placed) {
    for (const d of DIRS) out.push(edgeGeom(f, d.name));
  }
  return out;
}

/** 折叠后重合的另一条棱。每条棱恰好配对一条。 */
export function partnerEdge(fold: FoldResult, ref: EdgeRef): EdgeGeom | null {
  const face = fold.byId.get(ref.id);
  if (!face) return null;
  const mine = edgeGeom(face, ref.dir);
  for (const e of allEdges(fold)) {
    if (e.ref.id === ref.id) continue;
    if (vecEq(e.midpoint, mine.midpoint)) return e;
  }
  return null;
}

export function edgesCoincide(fold: FoldResult, a: EdgeRef, b: EdgeRef): boolean {
  const pa = partnerEdge(fold, a);
  return !!pa && pa.ref.id === b.id && pa.ref.dir === b.dir;
}

export function explainEdge(fold: FoldResult, ref: EdgeRef): string {
  const partner = partnerEdge(fold, ref);
  if (!partner) return "这条棱没有找到重合边。";
  const netAdj = areNetAdjacent(fold, ref, partner.ref);
  const codeA = edgeCode(ref.id, ref.dir);
  const codeB = edgeCode(partner.ref.id, partner.ref.dir);
  if (netAdj) {
    return `边 ${codeA} 与 ${codeB} 在展开图上已经相连，折后仍是同一条公共棱。`;
  }
  return `边 ${codeA} 与 ${codeB} 折叠后重合，是公共边。展开图上它们并不相邻，不能只凭「看起来靠近」判断。`;
}

function areNetAdjacent(fold: FoldResult, a: EdgeRef, b: EdgeRef): boolean {
  const fa = fold.byId.get(a.id);
  const fb = fold.byId.get(b.id);
  if (!fa || !fb) return false;
  const dx = fb.x - fa.x;
  const dy = fb.y - fa.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const expect = DIRS.find((d) => d.dx === dx && d.dy === dy)!;
  return a.dir === expect.name && b.dir === OPP[expect.name];
}

/** 箭头（图案「上」）指向本面的哪条棱，以及棱外的哪个面。 */
export function arrowPointsTo(fold: FoldResult, id: FaceId): { dir: Dir; partner: EdgeGeom | null; text: string } | null {
  const face = fold.byId.get(id);
  if (!face) return null;
  const { up } = patternAxes(face.basis, face.rot);
  let best: Dir = "N";
  let bestDot = -Infinity;
  for (const d of DIRS) {
    const outward =
      d.name === "N" ? face.basis.v : d.name === "S" ? neg(face.basis.v) : d.name === "E" ? face.basis.u : neg(face.basis.u);
    const dt = dot(up, outward);
    if (dt > bestDot) {
      bestDot = dt;
      best = d.name;
    }
  }
  const partner = partnerEdge(fold, { id, dir: best });
  const who = partner ? `指向 ${partner.ref.id} 面（公共边 ${edgeCode(id, best)} = ${edgeCode(partner.ref.id, partner.ref.dir)}）` : `指向棱 ${edgeCode(id, best)}`;
  return {
    dir: best,
    partner,
    text: `${id} 面的图案朝向${who}。`,
  };
}

export interface VertexGroup {
  key: string;
  point: Vec;
  corners: { id: FaceId; corner: DirCorner }[];
}

export type DirCorner = "NE" | "NW" | "SE" | "SW";

const POLY_ORDER: DirCorner[] = ["NE", "NW", "SW", "SE"];

const CORNERS: { name: DirCorner; su: number; sv: number }[] = [
  { name: "NE", su: 1, sv: 1 },
  { name: "NW", su: -1, sv: 1 },
  { name: "SE", su: 1, sv: -1 },
  { name: "SW", su: -1, sv: -1 },
];

export function cornerPoint(face: PlacedFace, corner: DirCorner): Vec {
  const c = CORNERS.find((x) => x.name === corner)!;
  return add(face.center, add(scale(face.basis.u, c.su), scale(face.basis.v, c.sv)));
}

/** 折叠后落在同一顶点的角。合法立方体每个顶点恰好汇合 3 个面。 */
export function vertexGroups(fold: FoldResult): VertexGroup[] {
  const map = new Map<string, VertexGroup>();
  for (const f of fold.placed) {
    for (const c of CORNERS) {
      const point = cornerPoint(f, c.name);
      const key = keyOf(point);
      let g = map.get(key);
      if (!g) {
        g = { key, point, corners: [] };
        map.set(key, g);
      }
      g.corners.push({ id: f.id, corner: c.name });
    }
  }
  return [...map.values()].sort((a, b) => b.corners.length - a.corners.length);
}

export function explainVertex(g: VertexGroup): string {
  const ids = [...new Set(g.corners.map((c) => c.id))];
  if (ids.length === 3) {
    return `该点由 ${ids.join("、")} 三面交汇。立体上这是同一个顶点，选项里三个面的角必须能对到这里。`;
  }
  if (ids.length < 3) {
    return `这个角目前只连到 ${ids.join("、")}。合法折完后应有第三个面加入。`;
  }
  return `有 ${ids.length} 个面挤在同一点（${ids.join("、")}），展开图不合法。`;
}

/**
 * 绕顶点的时针顺序。
 * outside=true：摄像机在立方体外，沿顶点向外的反方向看进去。
 * 内部视角是外部的逆序。做题必须用外部。
 */
export function clockOrder(fold: FoldResult, group: VertexGroup, outside: boolean): FaceId[] {
  const radial = normalize(group.point);
  const up = Math.abs(radial[1]) > 0.9 ? ([1, 0, 0] as Vec) : ([0, 1, 0] as Vec);
  const z = radial;
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  const ids = [...new Set(group.corners.map((c) => c.id))];
  const scored = ids.map((id) => {
    const c = fold.byId.get(id)!.center;
    const ang = Math.atan2(dot(c, y), dot(c, x));
    return { id, ang };
  });
  scored.sort((a, b) => a.ang - b.ang);
  const seq = scored.map((s) => s.id);
  if (outside) seq.reverse();
  return seq;
}

export function explainClock(fold: FoldResult, group: VertexGroup, outside: boolean): string {
  const seq = clockOrder(fold, group, true);
  const inn = clockOrder(fold, group, false);
  if (seq.length < 3) return "这个点没有三个面，不能用时针法。";
  const a = seq.join(" → ");
  const b = inn.join(" → ");
  if (outside) {
    return `从立方体外部看，绕该顶点顺时针为 ${a}。展开图若从纸的正面看，顺序应与此一致。内部看会变成 ${b}，方向相反，这是最常见的错。`;
  }
  return `当前是内部视角，顺时针读成 ${b}。它和外部顺序 ${a} 相反。选项若按内部画，直接排除。`;
}

/** 立方体的 24 个旋转，用来判断移块有没有改变相对关系（不许镜像）。 */
function cubeRotations(): ((v: Vec) => Vec)[] {
  const axes: Vec[] = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  const rots: ((v: Vec) => Vec)[] = [];
  for (const x of axes) {
    for (const y of axes) {
      if (Math.abs(dot(x, y)) > 0.1) continue;
      const z = cross(x, y);
      rots.push((v) => add(add(scale(x, v[0]), scale(y, v[1])), scale(z, v[2])));
    }
  }
  return rots;
}

const ROTS = cubeRotations();

/**
 * 两套折叠是否只差整个立方体的旋转。
 * 每个面的法向、图案朝向都要能对上，相对面和公共边因此不变。
 */
export function sameCubeUpToRotation(a: FoldResult, b: FoldResult): boolean {
  if (!a.valid || !b.valid) return false;
  for (const R of ROTS) {
    let ok = true;
    for (const id of FACE_IDS) {
      const pa = a.byId.get(id);
      const pb = b.byId.get(id);
      if (!pa || !pb) {
        ok = false;
        break;
      }
      if (!vecEq(R(pa.basis.n), pb.basis.n)) {
        ok = false;
        break;
      }
      const ua = patternAxes(pa.basis, pa.rot).up;
      const ub = patternAxes(pb.basis, pb.rot).up;
      if (!vecEq(R(ua), ub)) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

export interface MoveResult {
  ok: boolean;
  faces: Face[];
  reason: string;
}

/**
 * 把一个面滚到空格。
 * 目标必须与其余部分共边；四个朝向里只有能保持立体关系的才接受。
 * 重叠或悬空直接拒绝。
 */
export function tryMoveFace(faces: Face[], id: FaceId, tx: number, ty: number): MoveResult {
  const moving = faces.find((f) => f.id === id);
  if (!moving) return { ok: false, faces, reason: "没有这个面。" };
  if (moving.x === tx && moving.y === ty) return { ok: false, faces, reason: "还在原位。" };
  if (faces.some((f) => f.id !== id && f.x === tx && f.y === ty)) {
    return { ok: false, faces, reason: "目标格已经有面，移过去会重叠。" };
  }
  const others = faces.filter((f) => f.id !== id);
  const touches = others.some((f) => Math.abs(f.x - tx) + Math.abs(f.y - ty) === 1);
  if (!touches) {
    return {
      ok: false,
      faces,
      reason: "移开后该面与其他面没有公共边（悬空或只碰一个顶点）。展开图必须边与边相连。",
    };
  }
  const before = foldFaces(faces);
  if (!before.valid) {
    return { ok: false, faces, reason: "当前展开图本身不合法，先换一种合法图再移块。" };
  }
  for (let rot = 0; rot < 4; rot++) {
    const next = faces.map((f) => (f.id === id ? { ...f, x: tx, y: ty, rot } : f));
    const after = foldFaces(next);
    if (!after.valid) continue;
    if (sameCubeUpToRotation(before, after)) {
      return {
        ok: true,
        faces: next,
        reason: `${id} 滚到新位置，朝向已跟着转。相对面、公共边、图案朝向都没变。`,
      };
    }
  }
  const forced = foldFaces(faces.map((f) => (f.id === id ? { ...f, x: tx, y: ty } : f)));
  if (!forced.valid) {
    return { ok: false, faces, reason: "这个空位折起来会重叠，或者不能保持原来的公共边，已拒绝。" };
  }
  return {
    ok: false,
    faces,
    reason: "滚到这里会改变相对关系或变成镜像。移块只允许绕公共边滚到仍等价的空位。",
  };
}

/** 找出当前网能滚的所有合法移法，供「演示」按钮使用。 */
export function legalMoves(faces: Face[]): { id: FaceId; x: number; y: number }[] {
  const found: { id: FaceId; x: number; y: number }[] = [];
  for (const f of faces) {
    for (const d of DIRS) {
      const tx = f.x + d.dx;
      const ty = f.y + d.dy;
      const r = tryMoveFace(faces, f.id, tx, ty);
      if (r.ok) found.push({ id: f.id, x: tx, y: ty });
    }
    for (const o of faces) {
      if (o.id === f.id) continue;
      for (const d of DIRS) {
        const tx = o.x + d.dx;
        const ty = o.y + d.dy;
        if (tx === f.x && ty === f.y) continue;
        const r = tryMoveFace(faces, f.id, tx, ty);
        if (r.ok && !found.some((m) => m.id === f.id && m.x === tx && m.y === ty)) {
          found.push({ id: f.id, x: tx, y: ty });
        }
      }
    }
  }
  return found;
}

export function facesShareEdge(fold: FoldResult, a: FaceId, b: FaceId): boolean {
  for (const d of DIRS) {
    const p = partnerEdge(fold, { id: a, dir: d.name });
    if (p?.ref.id === b) return true;
  }
  return false;
}

/** 三个面两两有公共边，才构成一个可用于时针法的角。 */
export function tripleMeets(fold: FoldResult, ids: FaceId[]): VertexGroup | null {
  if (ids.length !== 3) return null;
  const groups = vertexGroups(fold).filter((g) => {
    const s = new Set(g.corners.map((c) => c.id));
    return ids.every((id) => s.has(id)) && s.size === 3;
  });
  return groups[0] ?? null;
}

export function makeFaces(
  cells: { id: FaceId; x: number; y: number; pattern?: PatternId; rot?: number }[],
): Face[] {
  return cells.map((c) => ({
    id: c.id,
    x: c.x,
    y: c.y,
    pattern: c.pattern ?? "blank",
    rot: c.rot ?? 0,
  }));
}

/** 读序：先上后下、先左后右，标 A–F。 */
export function labelCells(cells: { x: number; y: number }[], pattern: PatternId = "blank"): Face[] {
  const sorted = [...cells].sort((a, b) => b.y - a.y || a.x - b.x);
  return sorted.map((c, i) => ({
    id: FACE_IDS[i]!,
    x: c.x,
    y: c.y,
    pattern,
    rot: 0,
  }));
}

export interface ViewProjection {
  faces: {
    id: FaceId;
    pattern: PatternId;
    rot: number;
    polygon: { x: number; y: number }[];
    basis: Basis;
    center: Vec;
    normal: Vec;
  }[];
}

/** 从某个外侧方向看立方体，得到三个可见面的投影。屏幕 y 向上。 */
export function projectView(fold: FoldResult, view: Vec): ViewProjection {
  const nview = normalize(view);
  const up = Math.abs(nview[1]) > 0.85 ? ([0, 0, 1] as Vec) : ([0, 1, 0] as Vec);
  const z = nview;
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  const proj = (p: Vec) => ({ x: dot(p, x), y: dot(p, y) });
  const visible = fold.placed
    .filter((f) => dot(f.basis.n, nview) > 0.2)
    .sort((a, b) => dot(a.center, nview) - dot(b.center, nview));
  return {
    faces: visible.map((f) => {
      const poly = POLY_ORDER.map((name) => proj(cornerPoint(f, name)));
      return {
        id: f.id,
        pattern: f.pattern,
        rot: f.rot,
        polygon: poly,
        basis: f.basis,
        center: f.center,
        normal: f.basis.n,
      };
    }),
  };
}

export interface CameraFrame {
  x: Vec;
  y: Vec;
  z: Vec;
}

/** 与 projectView 同一套摄像机：z 指向观察者，x 向右，y 向上。 */
export function cameraFrame(view: Vec): CameraFrame {
  const z = normalize(view);
  const up = Math.abs(z[1]) > 0.85 ? ([0, 0, 1] as Vec) : ([0, 1, 0] as Vec);
  const x = normalize(cross(up, z));
  const y = cross(z, x);
  return { x, y, z };
}

export function onFace(face: PlacedFace, lu: number, lv: number, extent = 0.72): Vec {
  return add(face.center, add(scale(face.basis.u, lu * extent), scale(face.basis.v, lv * extent)));
}

export function projectVec(p: Vec, frame: CameraFrame): { x: number; y: number } {
  return { x: dot(p, frame.x), y: dot(p, frame.y) };
}

/** 图案局部坐标（右、上）落到面的 u、v 分量。mirror 为左右翻转，用来做内部视角干扰项。 */
export function localPattern(px: number, py: number, rot: number, mirror = false): { lu: number; lv: number } {
  const lx = mirror ? -px : px;
  const ly = py;
  const r = ((rot % 4) + 4) % 4;
  if (r === 0) return { lu: lx, lv: ly };
  if (r === 1) return { lu: ly, lv: -lx };
  if (r === 2) return { lu: -lx, lv: -ly };
  return { lu: -ly, lv: lx };
}
