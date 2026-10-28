import { CircuitError, type NetElement, type NodeId } from '../engine';
import { key, type Circuit, type Point } from './model';

export interface Netlist {
  elements: NetElement[];
  ground: NodeId;
  /** نام گره هر نقطه‌ی پایه‌ی قطعه (کلید: "x,y") */
  nodeByPoint: Map<string, NodeId>;
}

/**
 * تبدیل نقشه مدار به netlist: نقاطی که با سیم به هم وصل‌اند یک گره می‌شوند
 * (Union-Find). گره زمین '0' نام می‌گیرد و بقیه '1' و '2' و ...
 */
export function buildNetlist(c: Circuit): Netlist {
  if (!c.ground) throw new CircuitError('NO_GROUND', 'یک «زمین» روی یکی از نقاط مدار بگذار.');
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    const p = parent.get(k);
    if (p === undefined || p === k) return k;
    const root = find(p);
    parent.set(k, root);
    return root;
  };
  for (const p of c.parts) if (p.kind === 'W') parent.set(find(key(p.a)), find(key(p.b)));

  const names = new Map<string, NodeId>([[find(key(c.ground)), '0']]);
  const nodeByPoint = new Map<string, NodeId>();
  const nameOf = (pt: Point): NodeId => {
    const root = find(key(pt));
    let name = names.get(root);
    if (name === undefined) {
      name = String(names.size);
      names.set(root, name);
    }
    nodeByPoint.set(key(pt), name);
    return name;
  };
  const elements = c.parts.flatMap((p) =>
    p.kind === 'W' ? [] : [{ id: p.id, kind: p.kind, a: nameOf(p.a), b: nameOf(p.b), value: p.value, ic: p.ic }],
  );
  return { elements, ground: '0', nodeByPoint };
}
