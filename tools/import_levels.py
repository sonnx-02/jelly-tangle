"""Import hand-made levels from a level sheet (JSON) into js/level-data.js.

The sheet has one object per level. Its "baked" entry is the level in the exact JT.LEVEL_DATA format; the readable
fields next to it (board, traySlots, picture, wormList) describe the same level and are used to check it.

The sheet's boxes are portrait, the game's first layout. The game now uses landscape boxes, so every level is turned a
quarter turn clockwise on the way in: cell (x, y) moves to (rows-1-y, x) and every head direction (and every direction
a dizzy worm turns to) turns with it. The puzzle does not change: same worms, same blocking, same solution, same bot
fail rate. --keep-orientation stores the boxes as they are in the sheet.

    python tools/import_levels.py path/to/levels.json [--keep-orientation] [--dry-run]

Each sheet level replaces the js/level-data.js entry of its game level; every other entry is kept. The game has levels
the sheet does not (NOT_IN_SHEET: the rainbow went in as level 2, level 16 without mixing as level 23), so from level 2
on, sheet level n is game level n + 1 (n + 2 from game level 23 on).
js/core.js must describe the same boxes (LEVELS[i]: cols, rows, slots, pic, mix) or the game rejects the data and
generates a level instead, so the script prints the box each level needs. Mark those LEVELS entries designed: true so
that tools/levels.html keeps them when it re-bakes the generated levels.
"""
import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))   # dev_server.py sits next to this file
from dev_server import OUT, write_level_data  # noqa: E402

DIR_NAMES = ["up", "right", "down", "left"]          # core.js DIRS order
PALETTE = set("ROYGLBSTPKWCNDA")
NOT_IN_SHEET = [2, 23]                               # game levels (1-based) made outside the sheet, in order


def game_level(n):
    """The game level that sheet level n became: each level made outside the sheet pushes the later ones up one."""
    for g in NOT_IN_SHEET:
        if n >= g:
            n += 1
    return n


def die(msg):
    print("error: " + msg, file=sys.stderr)
    sys.exit(1)


def cells_of(code):
    return [(int(code[k]), int(code[k + 1])) for k in range(0, len(code), 2)]


def check(lv):
    """The baked level must be well formed and agree with the sheet's readable description of it."""
    n, b = lv.get("level"), lv.get("baked") or {}
    where = "level %s: " % n
    c, h = b.get("c"), b.get("h")
    if not (isinstance(c, list) and len(c) == 5 and isinstance(h, list) and h):
        die(where + "baked entry needs c[5] and h[]")
    cols, rows, slots, pic, mix = c
    board = lv.get("board", {})
    if (board.get("cols"), board.get("rows")) != (cols, rows):
        die(where + "board %sx%s does not match baked %sx%s" % (board.get("cols"), board.get("rows"), cols, rows))
    if lv.get("traySlots") != slots or lv.get("picture", {}).get("key") != pic:
        die(where + "tray slots or picture differ between the sheet and its baked entry")
    if lv.get("worms") != len(h) or len(lv.get("wormList", [])) != len(h):
        die(where + "worm count differs between the sheet and its baked entry")
    used = [set(), set()]
    for wid, (w, readable) in enumerate(zip(h, lv["wormList"])):
        col, paint, d, code, layers, covered, mystery, rot = w
        cells = cells_of(code)
        if col not in PALETTE or not (0 <= d < 4) or len(cells) < 2 or len(layers) != len(cells):
            die(where + "worm %d is malformed" % wid)
        if readable.get("id") != wid or readable.get("color") != col or readable.get("paint") != paint:
            die(where + "worm %d: colour or paint differs from the sheet" % wid)
        if [tuple(p) for p in readable.get("cellsTailToHead", [])] != cells:
            die(where + "worm %d: cells differ from the sheet" % wid)
        if readable.get("headDir") != DIR_NAMES[d] or bool(readable.get("mystery")) != bool(mystery):
            die(where + "worm %d: head direction or wrapping differs from the sheet" % wid)
        if sorted(readable.get("coveredBy", [])) != sorted(covered) or any(not (0 <= k < len(h)) or k == wid for k in covered):
            die(where + "worm %d: coveredBy is wrong" % wid)
        if rot and not (isinstance(rot, list) and len(rot) == 4 and all(0 <= x < 4 for x in rot[:3])):
            die(where + "worm %d: dizzy turns are malformed" % wid)
        for (x, y), ly in zip(cells, layers):
            if not (0 <= x < cols and 0 <= y < rows):
                die(where + "worm %d leaves the box at (%d, %d)" % (wid, x, y))
            if (x, y) in used[int(ly)]:
                die(where + "two worms share cell (%d, %d) on one layer" % (x, y))
            used[int(ly)].add((x, y))
    return b


def turn(b):
    """A quarter turn clockwise: (x, y) -> (rows-1-y, x), direction d -> d+1."""
    cols, rows, slots, pic, mix = b["c"]
    out = []
    for col, paint, d, code, layers, covered, mystery, rot in b["h"]:
        code2 = "".join("%d%d" % (rows - 1 - y, x) for x, y in cells_of(code))
        rot2 = [(x + 1) % 4 for x in rot[:3]] + [rot[3]] if rot else 0
        out.append([col, paint, (d + 1) % 4, code2, layers, list(covered), mystery, rot2])
    return {"c": [rows, cols, slots, pic, mix], "fr": b["fr"], "h": out}


def read_level_data():
    text = OUT.read_text(encoding="utf-8")
    rows = [line.strip().rstrip(",") for line in text.splitlines() if line.lstrip().startswith('{"c":')]
    return [json.loads(r) for r in rows]


def main():
    ap = argparse.ArgumentParser(description="Import a level sheet into js/level-data.js.")
    ap.add_argument("sheet", help="the level sheet (JSON)")
    ap.add_argument("--keep-orientation", action="store_true", help="store the boxes as drawn in the sheet")
    ap.add_argument("--dry-run", action="store_true", help="check and report, write nothing")
    args = ap.parse_args()

    sheet = json.loads(pathlib.Path(args.sheet).read_text(encoding="utf-8"))
    levels = sorted(sheet.get("levels", []), key=lambda lv: lv.get("level", 0))
    if not levels:
        die("the sheet has no levels")
    data = read_level_data()
    print("sheet  game  sheet box  game box  slots  picture     worms  bot fail  difficulty")
    for lv in levels:
        b = check(lv)
        new = b if args.keep_orientation else turn(b)
        n = game_level(lv["level"])
        if not (1 <= n <= len(data)):
            die("sheet level %d is game level %d, outside js/level-data.js (1..%d)" % (lv["level"], n, len(data)))
        data[n - 1] = new
        c = new["c"]
        print("%5d  %4d  %3dx%-5d  %3dx%-4d  %5d  %-10s  %5d  %7d%%  %s" % (lv["level"], n, b["c"][0], b["c"][1], c[0], c[1], c[2], c[3], len(new["h"]), new["fr"], lv.get("difficulty", "")))
    if args.dry_run:
        print("\ndry run: nothing written")
        return
    write_level_data(data)
    print("\nwrote %d levels to %s (%d from the sheet)" % (len(data), OUT.relative_to(OUT.parents[1]), len(levels)))
    print("js/core.js LEVELS[i] must match each 'game box' above (cols x rows), its slots and picture.")


if __name__ == "__main__":
    main()
