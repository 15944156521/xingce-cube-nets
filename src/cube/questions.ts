import {
  arrowPointsTo,
  cameraFrame,
  foldFaces,
  localPattern,
  onFace,
  oppositePairs,
  projectVec,
  projectView,
  vertexGroups,
  type Face,
  type FaceId,
  type PatternId,
  type Vec,
} from "./geometry.ts";
import { loadNet } from "./nets.ts";
import { rotForCorner } from "./patterns.ts";

export interface CubeOption {
  correct: boolean;
  reason: string;
  step: "opposite" | "edge" | "vertex" | "clock";
  view: Vec;
  mirror: boolean;
  faces: Face[];
}

export interface NetChoice {
  netId: string;
  correct: boolean;
  reason: string;
}

export interface Quiz {
  id: string;
  title: string;
  stem: string;
  method: string;
  faces: Face[];
  shape: "cube" | "which-net";
  options: CubeOption[];
  nets: NetChoice[];
  review: string[];
}

const VIEWS: Vec[] = [
  [1, 1, 1],
  [-1, 1, 1],
  [1, 1, -1],
  [-1, 1, -1],
  [1, -1, 1],
  [-1, -1, 1],
  [1, -1, -1],
  [-1, -1, -1],
];

function paint(netId: string, spec: Partial<Record<FaceId, [PatternId, number]>>): Face[] {
  return loadNet(netId).map((f) => {
    const s = spec[f.id];
    return s ? { ...f, pattern: s[0], rot: s[1] } : f;
  });
}

function clone(faces: Face[]): Face[] {
  return faces.map((f) => ({ ...f }));
}

function swapPatterns(faces: Face[], a: FaceId, b: FaceId): Face[] {
  const next = clone(faces);
  const A = next.find((f) => f.id === a)!;
  const B = next.find((f) => f.id === b)!;
  const p = A.pattern;
  const r = A.rot;
  A.pattern = B.pattern;
  A.rot = B.rot;
  B.pattern = p;
  B.rot = r;
  return next;
}

function spin(faces: Face[], id: FaceId, by = 1): Face[] {
  return faces.map((f) => (f.id === id ? { ...f, rot: (f.rot + by + 4) % 4 } : f));
}

/** 选项画出来是否一样：只看当前视角下三个面的图案落点。 */
export function optionSig(faces: Face[], view: Vec, mirror = false): string {
  const fold = foldFaces(faces);
  if (!fold.valid) return "invalid";
  const frame = cameraFrame(view);
  const vis = projectView(fold, view);
  return vis.faces
    .map((f) => {
      const placed = fold.byId.get(f.id)!;
      const a = localPattern(0, 0.75, f.rot, mirror);
      const b = localPattern(0.62, -0.2, f.rot, mirror);
      const pa = projectVec(onFace(placed, a.lu, a.lv), frame);
      const pb = projectVec(onFace(placed, b.lu, b.lv), frame);
      return `${f.pattern}:${pa.x.toFixed(2)},${pa.y.toFixed(2)}:${pb.x.toFixed(2)},${pb.y.toFixed(2)}`;
    })
    .join("|");
}

function visible(faces: Face[], view: Vec): FaceId[] {
  const fold = foldFaces(faces);
  return projectView(fold, view).faces.map((f) => f.id);
}

function viewShowing(faces: Face[], ids: FaceId[]): Vec {
  for (const v of VIEWS) {
    const got = new Set(visible(faces, v));
    if (ids.every((id) => got.has(id))) return v;
  }
  return VIEWS[0]!;
}

function cubeQuiz(partial: Omit<Quiz, "options" | "nets" | "shape"> & { options: CubeOption[] }): Quiz {
  return { ...partial, shape: "cube", nets: [] };
}

function qOpposite(): Quiz {
  const faces = paint("141-22", {
    A: ["arrow", 1],
    B: ["diagonal", 0],
    C: ["shang", 1],
    D: ["triangle", 0],
    E: ["tee", 1],
    F: ["dot", 0],
  });
  const view = viewShowing(faces, ["A", "B"]);
  const fold = foldFaces(faces);
  const pair = oppositePairs(fold).find((p) => p.a === "A" || p.b === "A")!;
  const other = pair.a === "A" ? pair.b : pair.a;
  return cubeQuiz({
    id: "opp-cross",
    title: "相对面排除",
    stem: "十字展开。先找相对面：若选项把相对面的图案当成了相邻，直接排除。四个选项是同一观察方向。",
    method: "相间是对面。相对面的图案不能出现在相邻的位置上。",
    faces,
    review: [
      `① ${pair.text}`,
      `② 把 ${pair.a} 与 ${other} 的图案对调，等于让相对面的图案跑到相邻位置。`,
      "③ 再看三角有没有贴错棱，最后看整体是不是从内部画反了。",
    ],
    options: [
      { correct: true, reason: "图案、相对位置和朝向都与展开图一致。", step: "opposite", view, mirror: false, faces },
      {
        correct: false,
        reason: `${pair.a} 与 ${other} 相对，这个选项把它们的图案对调了，相对面被当成了可以相邻。`,
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, pair.a, other),
      },
      {
        correct: false,
        reason: "D 面三角多转了 90°，贴着的公共边不对。",
        step: "edge",
        view,
        mirror: false,
        faces: spin(faces, "D"),
      },
      {
        correct: false,
        reason: "整幅图左右相反，相当于从立方体内部看，时针反了。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
    ],
  });
}

function qZ(): Quiz {
  const faces = paint("222", {
    A: ["arrow", 1],
    B: ["triangle", 0],
    C: ["diagonal", 0],
    D: ["shang", 1],
    E: ["tee", 1],
    F: ["dot", 0],
  });
  const fold = foldFaces(faces);
  const pairs = oppositePairs(fold);
  const z = pairs.find((p) => p.rule === "z") ?? pairs[0]!;
  const view = viewShowing(faces, [z.a]);
  return cubeQuiz({
    id: "z-222",
    title: "Z 字两端",
    stem: "这是 222 阶梯。没有「隔一个面」的直线，三对相对面都是 Z 字（含旋转）的两端。",
    method: "二二二，阶梯路，Z 字两端是对面。",
    faces,
    review: [
      pairs.map((p) => p.text).join(" "),
      "阶梯里可以同时看出好几组 Z，每一组两端都相对。",
      "选项若把某一对 Z 字端点的图案放到相邻面上，排除。",
    ],
    options: [
      { correct: true, reason: "三对 Z 字相对都保持住了，朝向也没反。", step: "opposite", view, mirror: false, faces },
      {
        correct: false,
        reason: `${z.text}这个选项把两端的图案换了位置。`,
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, z.a, z.b),
      },
      {
        correct: false,
        reason: "B 面三角转了 90°，公共点的角对不上。",
        step: "vertex",
        view,
        mirror: false,
        faces: spin(faces, "B"),
      },
      {
        correct: false,
        reason: "对角线和三角被镜像了，这是内部视角，时针相反。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
    ],
  });
}

function qArrow(): Quiz {
  const faces = paint("141-23", {
    A: ["arrow", 0],
    B: ["diagonal", 0],
    C: ["triangle", 0],
    D: ["shang", 0],
    E: ["tee", 0],
    F: ["dot", 0],
  });
  const fold = foldFaces(faces);
  const info = arrowPointsTo(fold, "A")!;
  const view = viewShowing(faces, ["A"]);
  const wrong = spin(faces, "A");
  const info2 = arrowPointsTo(foldFaces(wrong), "A")!;
  return cubeQuiz({
    id: "arrow-edge",
    title: "箭头贴错边",
    stem: "先不管其他面，只追 A 面上的箭头：它折完指向哪一条公共边。箭头转 90° 就会贴到另一条棱。",
    method: "箭头指向谁，就先画谁和它的公共边。",
    faces,
    review: [
      info.text,
      `转 90° 之后变成：${info2.text}`,
      "公共边错了，这个选项排除，不必再看别的面。",
    ],
    options: [
      { correct: true, reason: info.text, step: "edge", view, mirror: false, faces },
      {
        correct: false,
        reason: `箭头转了 90°。${info2.text}和展开图不是同一条公共边。`,
        step: "edge",
        view,
        mirror: false,
        faces: wrong,
      },
      {
        correct: false,
        reason: "对角线被镜像，相当于从里面看这条棱，方向反了。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
      {
        correct: false,
        reason: "C 面三角离开了原来的顶点，三个角交不到一点。",
        step: "vertex",
        view,
        mirror: false,
        faces: spin(faces, "C"),
      },
    ],
  });
}

function qVertex(): Quiz {
  const base = loadNet("141-22");
  const fold0 = foldFaces(base);
  const group = vertexGroups(fold0).find((g) => new Set(g.corners.map((c) => c.id)).size === 3)!;
  const ids = [...new Set(group.corners.map((c) => c.id))];
  const faces = base.map((f) => {
    const corner = group.corners.find((c) => c.id === f.id);
    if (!corner) return { ...f, pattern: "blank" as const, rot: 0 };
    return { ...f, pattern: "triangle" as const, rot: rotForCorner(corner.corner) };
  });
  const view: Vec = [group.point[0], group.point[1], group.point[2]];
  const spinId = ids[0]!;
  const opp = oppositePairs(foldFaces(faces)).find((p) => p.a === ids[1] || p.b === ids[1])!;
  return cubeQuiz({
    id: "tri-vertex",
    title: "公共点对不上",
    stem: `阴影三角标在 ${ids.join("、")} 的交角上。折完后这三只角必须落到同一个顶点。观察方向正对这个角。`,
    method: "三个面交于一点，角要能同时对上。",
    faces,
    review: [
      `这个顶点由 ${ids.join("、")} 汇合。`,
      `${spinId} 的三角若转 90°，角就离开了公共点。`,
      "相对面不可能参加这个角。谁把相对面的三角画进来，排除。",
    ],
    options: [
      { correct: true, reason: "三只阴影角都指向同一个顶点。", step: "vertex", view, mirror: false, faces },
      {
        correct: false,
        reason: `${spinId} 面的三角转了 90°，三个角不再交于一点。`,
        step: "vertex",
        view,
        mirror: false,
        faces: spin(faces, spinId),
      },
      {
        correct: false,
        reason: `${opp.a} 与 ${opp.b} 相对，相对面不能出现在这个角上。选项把三角换到了相对面。`,
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, opp.a, opp.b),
      },
      {
        correct: false,
        reason: "从内部看，三角会翻到顶点的另一侧。做题必须从外部看。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
    ],
  });
}

function qClock(): Quiz {
  const faces = paint("33", {
    A: ["shang", 1],
    B: ["diagonal", 0],
    C: ["arrow", 1],
    D: ["triangle", 0],
    E: ["tee", 1],
    F: ["dot", 0],
  });
  const view = viewShowing(faces, ["B", "D"]);
  const fold = foldFaces(faces);
  const pair = oppositePairs(fold).find((p) => p.rule === "row") ?? oppositePairs(fold)[0]!;
  return cubeQuiz({
    id: "clock-33",
    title: "时针看反了",
    stem: "33 型。汉字「上」和对角线都有方向。从纸的正面读到的顺序，要和从立方体外面看的一致。",
    method: "内外相反。选项若是镜像，就是从里面看的。",
    faces,
    review: [
      "先用相对面删掉把对面画成邻面的选项。",
      "剩下的用时针：对角线的头、汉字的朝向，外部看和内部看是反的。",
      pair.text,
    ],
    options: [
      { correct: true, reason: "从外部看，汉字和对角线的朝向与展开图一致。", step: "clock", view, mirror: false, faces },
      {
        correct: false,
        reason: "这是内部视角的镜像。顺时针读到的面序整个反了。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
      {
        correct: false,
        reason: `${pair.a} 与 ${pair.b} 相对（${pair.text}），图案却被换到了相对面的位置。`,
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, pair.a, pair.b),
      },
      {
        correct: false,
        reason: "A 面的「上」多转了 90°，公共边对不上。",
        step: "edge",
        view,
        mirror: false,
        faces: spin(faces, "A"),
      },
    ],
  });
}

function qMove(): Quiz {
  const faces = paint("141-22", {
    A: ["arrow", 1],
    B: ["triangle", 0],
    C: ["diagonal", 0],
    D: ["shang", 1],
    E: ["tee", 1],
    F: ["dot", 0],
  });
  const view: Vec = [1, 1, 1];
  const fold = foldFaces(faces);
  const pair = oppositePairs(fold)[0]!;
  return cubeQuiz({
    id: "move-same",
    title: "移块后仍等价",
    stem: "十字可以滚成 132。移块只改展开图的形状，不改相对面和图案朝向。所以折出来的还是这一个正方体。",
    method: "移块不改相对关系。折完的图，移前移后是同一个。",
    faces,
    review: [
      "先在十字上读出三对相对面，移成 132 之后再读一遍，字母对不变。",
      "因此选项只要把相对面画成相邻，移块也救不了它。",
      "镜像不是移块，移块不许翻面。",
    ],
    options: [
      { correct: true, reason: "无论停在 141 还是滚成 132，外部看到的都是这一幅。", step: "opposite", view, mirror: false, faces },
      {
        correct: false,
        reason: `${pair.text}移块不会把这一对换成相邻。`,
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, pair.a, pair.b),
      },
      {
        correct: false,
        reason: "有人以为滚过去会翻面。移块保持朝向，镜像是错的。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
      {
        correct: false,
        reason: "B 面三角转了 90°，公共点已经对不上，移块不会凭空转图案。",
        step: "vertex",
        view,
        mirror: false,
        faces: spin(faces, "B"),
      },
    ],
  });
}

function qEnds(): Quiz {
  const faces = paint("141-14", {
    A: ["shang", 1],
    B: ["arrow", 1],
    C: ["diagonal", 0],
    D: ["triangle", 0],
    E: ["tee", 1],
    F: ["dot", 0],
  });
  const fold = foldFaces(faces);
  const pairs = oppositePairs(fold);
  const hard = pairs.find((p) => p.rule === "fold") ?? pairs[0]!;
  const view = viewShowing(faces, [hard.a]);
  return cubeQuiz({
    id: "ends-1414",
    title: "异侧两端仍相对",
    stem: "四连两头各有一个面，而且分居上下两侧。这是合法的 141。两头那一对相对，但不能误用「同侧才重叠」把它判死。",
    method: "异侧贴在两端仍然合法。同侧才重叠。",
    faces,
    review: [
      pairs.map((p) => p.text).join(" "),
      `${hard.a} 与 ${hard.b} 不共边，折完相对。`,
      "若把这两个侧边改到同一侧，展开图本身就不合法。",
    ],
    options: [
      { correct: true, reason: "异侧两端折完是相对面，图案位置正确。", step: "opposite", view, mirror: false, faces },
      {
        correct: false,
        reason: `${hard.text}选项把这一对的图案放到了相邻处。`,
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, hard.a, hard.b),
      },
      {
        correct: false,
        reason: "D 面三角离开公共点。",
        step: "vertex",
        view,
        mirror: false,
        faces: spin(faces, "D"),
      },
      {
        correct: false,
        reason: "朝向被镜像，时针反了。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
    ],
  });
}

function q231(): Quiz {
  const faces = paint("231-step", {
    A: ["arrow", 1],
    B: ["diagonal", 0],
    C: ["triangle", 1],
    D: ["shang", 1],
    E: ["tee", 1],
    F: ["dot", 1],
  });
  const fold = foldFaces(faces);
  const pairs = oppositePairs(fold);
  const z = pairs.find((p) => p.rule === "z") ?? pairs[0]!;
  const view = viewShowing(faces, [z.a, "C"]);
  return cubeQuiz({
    id: "z-231",
    title: "132 里的 Z 字",
    stem: "132/231 的台阶变体。三连上隔一个的那对很好认，另外两对要靠 Z 字。从另一头读，这张图就叫 231。",
    method: "一二隔河见。河这边的 2 和河那边的 1，用 Z 字找对面。",
    faces,
    review: [
      pairs.map((p) => `${p.a}${p.b}（${p.rule === "row" || p.rule === "col" ? "隔一面" : p.rule === "z" ? "Z 字" : "折后不相邻"}）`).join("，"),
      z.text,
      "三种 132/231 只是「2」的位置不同，找对面的方法一样。",
    ],
    options: [
      { correct: true, reason: "隔一面的一对和 Z 字的两对都对，朝向也对。", step: "opposite", view, mirror: false, faces },
      {
        correct: false,
        reason: z.text + "选项把 Z 字两端画成了相邻。",
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, z.a, z.b),
      },
      {
        correct: false,
        reason: "C 面三角转了 90°，角离开了公共顶点。",
        step: "vertex",
        view,
        mirror: false,
        faces: spin(faces, "C"),
      },
      {
        correct: false,
        reason: "图案左右颠倒，是内部视角。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
    ],
  });
}

function qStraight(): Quiz {
  const faces = paint("231-straight", {
    A: ["tee", 1],
    B: ["arrow", 1],
    C: ["diagonal", 0],
    D: ["triangle", 0],
    E: ["shang", 1],
    F: ["dot", 0],
  });
  const info = arrowPointsTo(foldFaces(faces), "B")!;
  const view = viewShowing(faces, ["B", "D"]);
  return cubeQuiz({
    id: "arrow-231",
    title: "直二上的箭头",
    stem: "132/231 的「直二」。B 面箭头要先落到正确的公共边上，再谈别的面。",
    method: "先定公共边，箭头才有归宿。",
    faces,
    review: [info.text, "箭头转 90° 就贴到相邻的另一条棱。", "相对面绝不会被这支箭头指到，因为相对面不共边。"],
    options: [
      { correct: true, reason: info.text, step: "edge", view, mirror: false, faces },
      {
        correct: false,
        reason: `箭头方向反了 90°。${arrowPointsTo(foldFaces(spin(faces, "B")), "B")!.text}`,
        step: "edge",
        view,
        mirror: false,
        faces: spin(faces, "B"),
      },
      {
        correct: false,
        reason: "D 面三角没有对准三个面的公共点。",
        step: "vertex",
        view,
        mirror: false,
        faces: spin(faces, "D"),
      },
      {
        correct: false,
        reason: "镜像之后箭头仍可能沿自身对称，但对角线和三角已经翻面，时针反了。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
    ],
  });
}

function qSide(): Quiz {
  const faces = paint("231-side", {
    A: ["diagonal", 0],
    B: ["triangle", 2],
    C: ["arrow", 1],
    D: ["shang", 1],
    E: ["dot", 1],
    F: ["tee", 1],
  });
  const fold = foldFaces(faces);
  const pairs = oppositePairs(fold);
  const hard = pairs.find((p) => p.rule === "fold" || p.rule === "z") ?? pairs[0]!;
  const view = viewShowing(faces, [hard.a]);
  return cubeQuiz({
    id: "side-231",
    title: "侧二的相对面",
    stem: "第三种 132/231：两个面在三连斜上方。不要因为形状眼生就换一套相对面。",
    method: "变体改形状，不改「隔一面 / Z 字 / 折后不相邻」。",
    faces,
    review: [
      pairs.map((p) => p.text).join(" "),
      "点任意一面，右侧会写出用的是哪条规则。",
      "排除时先做相对面，省下的再用棱和点。",
    ],
    options: [
      { correct: true, reason: "相对面和图案朝向都与这张侧二展开图一致。", step: "opposite", view, mirror: false, faces },
      {
        correct: false,
        reason: hard.text + "这里被画反了。",
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, hard.a, hard.b),
      },
      {
        correct: false,
        reason: "C 面箭头贴错了公共边。",
        step: "edge",
        view,
        mirror: false,
        faces: spin(faces, "C"),
      },
      {
        correct: false,
        reason: "整体镜像，时针相反。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
    ],
  });
}

function qRow(): Quiz {
  const faces = paint("141-11", {
    A: ["dot", 0],
    B: ["arrow", 1],
    C: ["triangle", 0],
    D: ["diagonal", 0],
    E: ["shang", 1],
    F: ["tee", 1],
  });
  const fold = foldFaces(faces);
  const col = oppositePairs(fold).find((p) => p.rule === "col")!;
  const view = viewShowing(faces, [col.a === "A" ? "B" : col.a, "C"]);
  return cubeQuiz({
    id: "col-gap",
    title: "同列隔一面",
    stem: "141 的侧边在同一列的上下。中间隔着四连里的那个面，两端相对。这一对最容易被一眼看出来。",
    method: "同列隔一面，两端相对。相对面不共边。",
    faces,
    review: [
      col.text,
      "四连本身还有两对「同行隔一面」。",
      "圆点偏上，转 90° 之后就不再指向原来的棱。",
    ],
    options: [
      { correct: true, reason: "隔一面的三对都在，圆点和箭头的朝向正确。", step: "opposite", view, mirror: false, faces },
      {
        correct: false,
        reason: `${col.text}选项把这一对图案换成了相邻。`,
        step: "opposite",
        view,
        mirror: false,
        faces: swapPatterns(faces, col.a, col.b),
      },
      {
        correct: false,
        reason: "偏上的圆点转了 90°，贴着的边变了。",
        step: "edge",
        view,
        mirror: false,
        faces: spin(faces, "A"),
      },
      {
        correct: false,
        reason: "三角和对角线被镜像，时针反了。",
        step: "clock",
        view,
        mirror: true,
        faces,
      },
    ],
  });
}

export function whichNetQuiz(): Quiz {
  return {
    id: "illegal-net",
    title: "非法展开干扰",
    stem: "下面四张里只有一张不能折成无重叠的正方体。先看有没有田、凹、实心日字，再看侧边是不是同侧叠在四连两头。",
    method: "没有凹和田。日字必须错开，不能实心。同侧两端必重叠。",
    faces: loadNet("bad-tian"),
    shape: "which-net",
    options: [],
    nets: [
      { netId: "141-22", correct: false, reason: "十字是最标准的 141，六面各就各位。" },
      { netId: "222", correct: false, reason: "阶梯 222 合法，三对相对面都是 Z 字两端。" },
      { netId: "bad-tian", correct: true, reason: "含田字。四个面围成一圈，折起来必定有两个面重合。" },
      { netId: "33", correct: false, reason: "两个三连只错开一条边，这是唯一合法的 33，不是实心日字。" },
    ],
    review: [
      "田字、凹字、实心日字、只靠顶点相连，都要在折之前淘汰。",
      "合法的 11 种里没有这些形状。",
      "口诀：相邻一层必有日，整体没有凹和田。这里的「日」是错开的，不是 2×3 实心。",
    ],
  };
}

function retarget(q: Quiz): Quiz {
  if (q.shape !== "cube") return q;
  for (const view of VIEWS) {
    const options = q.options.map((o) => ({ ...o, view }));
    const sigs = options.map((o) => optionSig(o.faces, o.view, o.mirror));
    if (sigs.every((s) => s !== "invalid") && new Set(sigs).size === options.length) {
      return { ...q, options };
    }
  }
  return q;
}

export const QUIZZES: Quiz[] = [
  qOpposite(),
  qZ(),
  qArrow(),
  qVertex(),
  qClock(),
  qMove(),
  qEnds(),
  q231(),
  qStraight(),
  qSide(),
  qRow(),
  whichNetQuiz(),
].map(retarget);

export function auditQuizzes(): string[] {
  const problems: string[] = [];
  for (const q of QUIZZES) {
    if (q.shape === "which-net") {
      const goods = q.nets.filter((n) => n.correct);
      if (goods.length !== 1) problems.push(`${q.id} net answers ${goods.length}`);
      continue;
    }
    if (!foldFaces(q.faces).valid) problems.push(`${q.id} stem invalid`);
    const sigs = q.options.map((o) => optionSig(o.faces, o.view, o.mirror));
    const correct = q.options.filter((o) => o.correct);
    if (correct.length !== 1) problems.push(`${q.id} correct count`);
    sigs.forEach((s, i) => {
      if (s === "invalid") problems.push(`${q.id} option ${i} invalid`);
      const dup = sigs.findIndex((t, j) => j !== i && t === s);
      if (dup >= 0) problems.push(`${q.id} option ${i} looks like ${dup}`);
    });
  }
  return problems;
}

/** 用学生当前的展开图出一道判断题。图案太少时补上能分辨朝向的图案。 */
export function quizFromFaces(raw: Face[]): Quiz | { error: string } {
  const fold = foldFaces(raw);
  if (!fold.valid) return { error: fold.reason };
  let faces = clone(raw);
  const asymmetric = faces.filter((f) => f.pattern === "diagonal" || f.pattern === "triangle" || f.pattern === "arrow");
  if (asymmetric.length < 2) {
    const order: [PatternId, number][] = [
      ["arrow", 1],
      ["triangle", 0],
      ["diagonal", 0],
      ["shang", 1],
      ["tee", 1],
      ["dot", 0],
    ];
    faces = faces.map((f, i) => ({ ...f, pattern: order[i]![0], rot: order[i]![1] }));
  }
  const view = VIEWS.find((v) => optionSig(faces, v, false) !== optionSig(faces, v, true)) ?? VIEWS[0]!;
  const pairs = oppositePairs(foldFaces(faces));
  const vis = new Set(visible(faces, view));
  const pair = pairs.find((p) => vis.has(p.a) || vis.has(p.b)) ?? pairs[0]!;
  const spinId = faces.find((f) => vis.has(f.id) && f.pattern !== "blank" && f.pattern !== "cross")?.id ?? faces[0]!.id;
  const options: CubeOption[] = [
    { correct: true, reason: "和你贴的图案一致，是从外部看到的折法。", step: "opposite", view, mirror: false, faces },
    {
      correct: false,
      reason: `${pair.text}这一项把相对面的图案换位了。`,
      step: "opposite",
      view,
      mirror: false,
      faces: swapPatterns(faces, pair.a, pair.b),
    },
    {
      correct: false,
      reason: `${spinId} 面的图案多转了 90°，公共边或公共点对不上。`,
      step: "edge",
      view,
      mirror: false,
      faces: spin(faces, spinId),
    },
    {
      correct: false,
      reason: "左右镜像，等于从立方体内部看，时针反了。",
      step: "clock",
      view,
      mirror: true,
      faces,
    },
  ];
  const sigs = options.map((o) => optionSig(o.faces, o.view, o.mirror));
  if (new Set(sigs).size < 4) {
    return { error: "这组图案在该视角下分不出四个选项。请再贴一个三角形或对角线。" };
  }
  return {
    id: "custom",
    title: "自己出的题",
    stem: "按你现在的展开图和图案，从同一方向看，哪个是折出来的正方体？",
    method: "先相对面，再公共边，再公共点，最后时针。",
    faces,
    shape: "cube",
    options,
    nets: [],
    review: [
      pairs.map((p) => p.text).join(" "),
      `${spinId} 面的朝向是用来核对公共边的。`,
      "镜像的那个选项，是内部视角。",
    ],
  };
}
