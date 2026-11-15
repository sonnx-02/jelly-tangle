"""Make the dev build's page, dev/index.html, from index.html.

The game ships in two builds of the same files:
  product  index.html and the plain APK. No cheat panel: js/cheat.js is not loaded at all, and cheat switches left
           in an old save do nothing.
  dev      dev/index.html and the dev APK (tools/android/build_apk.py --dev). The cheat panel (js/cheat.js), and its
           own saved progress (window.JT_DEV: js/util.js keeps it under another key), so testing never touches a
           real save.

    python tools/make_dev.py           write dev/index.html (run it after every change to index.html)
    python tools/make_dev.py --check   exit 1 if dev/index.html is out of date

dev/index.html sits one folder down, so it gets <base href="../"> and loads everything from the game's own folders.
tools/android/build_apk.py --dev uses dev_html() for the dev APK's start page.
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / "index.html", ROOT / "dev" / "index.html"
MARK = "<!-- Made by tools/make_dev.py from index.html: do not edit by hand. -->\n"


def dev_html(text, base=None):
    """index.html -> the dev build's page: the dev flag before the first script, the cheat panel after js/ui.js."""
    steps = [
        ('<meta charset="utf-8">\n', '<meta charset="utf-8">\n' + ('<base href="%s">\n' % base if base else '')),
        ('<title>Jelly Tangle</title>', '<title>Jelly Tangle · Dev</title>'),
        ('<script src="js/util.js"></script>', '<script>window.JT_DEV = true;</script>\n<script src="js/util.js"></script>'),
        ('<script src="js/cursor.js"></script>', '<script src="js/cheat.js"></script>\n<script src="js/cursor.js"></script>'),
    ]
    text = text.replace('\r\n', '\n')
    for old, new in steps:
        if text.count(old) != 1:
            raise SystemExit("make_dev: index.html should have exactly one %r" % old)
        text = text.replace(old, new)
    return text.replace('<!doctype html>\n', '<!doctype html>\n' + MARK, 1)


def main():
    page = dev_html(SRC.read_text(encoding="utf-8"), base="../")
    if "--check" in sys.argv:
        ok = OUT.is_file() and OUT.read_text(encoding="utf-8").replace('\r\n', '\n') == page
        print("dev/index.html is " + ("up to date" if ok else "out of date: run python tools/make_dev.py"))
        sys.exit(0 if ok else 1)
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(page, encoding="utf-8", newline="\n")
    print("wrote " + str(OUT.relative_to(ROOT)))


if __name__ == "__main__":
    main()
