/**
 * Geometria das linhas de conexão do canvas (coordenadas do fluxo): ponto da
 * linha mais perto do mouse (botão de excluir) e corte pela tesoura.
 */

export type Point = { x: number; y: number };

/** Amostra o path em pontos espaçados ~`step` unidades. */
export function samplePath(path: SVGPathElement, step = 8): Point[] {
  const total = path.getTotalLength();
  const n = Math.max(2, Math.ceil(total / step));
  const points: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const p = path.getPointAtLength((total * i) / n);
    points.push({ x: p.x, y: p.y });
  }
  return points;
}

/** Ponto do path mais perto de `target`: busca grossa + refino binário. */
export function nearestPointOnPath(path: SVGPathElement, target: Point): Point {
  const total = path.getTotalLength();
  const dist = (len: number) => {
    const p = path.getPointAtLength(len);
    return (p.x - target.x) ** 2 + (p.y - target.y) ** 2;
  };

  const coarse = Math.max(16, Math.ceil(total / 16));
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i <= coarse; i++) {
    const len = (total * i) / coarse;
    const d = dist(len);
    if (d < bestDist) {
      bestDist = d;
      best = len;
    }
  }

  let span = total / coarse;
  while (span > 0.5) {
    span /= 2;
    const before = Math.max(0, best - span);
    const after = Math.min(total, best + span);
    const dBefore = dist(before);
    const dAfter = dist(after);
    if (dBefore < bestDist) {
      bestDist = dBefore;
      best = before;
    } else if (dAfter < bestDist) {
      bestDist = dAfter;
      best = after;
    }
  }

  const p = path.getPointAtLength(best);
  return { x: p.x, y: p.y };
}

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsIntersect(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

/** True se as duas polilinhas se cruzam em algum segmento. */
export function polylinesIntersect(a: Point[], b: Point[]): boolean {
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      if (segmentsIntersect(a[i - 1], a[i], b[j - 1], b[j])) return true;
    }
  }
  return false;
}
