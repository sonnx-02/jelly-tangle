/* Level access. The first levels come from js/level-data.js: each one was generated, checked by the solver
   and the difficulty bot, then stored as data, so the player always gets exactly the level that was tested
   and nothing has to be searched on the phone. Levels past the baked table are searched at runtime (the
   solver guarantees those are solvable too). Re-bake with tools/levels.html after changing LEVELS in core.js. */
(function () {
  'use strict';
  const JT = window.JT, C = JT.Core;
  const cache = {};
  JT.Levels = {
    count() { return (JT.LEVEL_DATA || []).length; },
    get(idx) {
      if (!cache[idx]) {
        const d = (JT.LEVEL_DATA || [])[idx];
        let L = d ? C.levelFromData(idx, d) : null;
        if (!L) L = C.buildLevel(idx, { budgetMs: 700 });
        if (!L) L = C.buildLevel(idx, { attempts: 400 });
        cache[idx] = L;
      }
      return cache[idx];
    },
    clear() { for (const k in cache) delete cache[k]; }
  };
})();
