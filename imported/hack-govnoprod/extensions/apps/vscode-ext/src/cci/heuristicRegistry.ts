import * as fs from "fs";
import * as path from "path";
import { Heuristic } from "./types";

// dynamic import of heuristics in ./heuristics/*.ts
export function loadHeuristicsFromDir(dir: string): Heuristic[] {
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js") || f.endsWith(".ts"));
  const heuristics: Heuristic[] = [];
  for (const file of files) {
    try {
      const full = path.join(dir, file);
      // require so this runs in node (vsix runtime)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require(full);
      if (mod && mod.default) {
        heuristics.push(mod.default as Heuristic);
      } else if (mod && mod.heuristic) {
        heuristics.push(mod.heuristic as Heuristic);
      } else if (mod && mod.run && mod.id) {
        // adapt older style: run(content, relpath) and pass through optional finalize/extensions
        const h: any = { id: mod.id, scope: (mod.scope as any) || 'file', run: async (ctx: any, input: any) => mod.run(input.content, input.file) };
        if (mod.finalize) h.finalize = mod.finalize;
        if (mod.extensions) h.extensions = mod.extensions;
        heuristics.push(h as Heuristic);
      }
    } catch (e) {
      // ignore single heuristic load failure
    }
  }
  return heuristics;
}

export function registerHeuristics(list: Heuristic[]): Record<string, Heuristic> {
  const map: Record<string, Heuristic> = {};
  for (const h of list) {
    map[h.id] = h;
  }
  return map;
}


