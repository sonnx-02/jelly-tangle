"""Download the game's two typefaces into the repo, so the game never makes a network font request.

Baloo 2 (700, 800) and Nunito (700, 800, 900) come from Google Fonts as woff2, Vietnamese + Latin + Latin Extended
subsets only (the browser picks a file by its unicode-range, so a page loads just what its text needs). The script
writes assets/fonts/*.woff2 and css/fonts.css (the @font-face rules, pointing at the local files), and fetches each
family's SIL Open Font License, which has to travel with the fonts.

    python tools/fetch_fonts.py

Only needed again to change weights or update the fonts; the files are committed.
"""
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
FONTS = ROOT / "assets" / "fonts"
CSS_OUT = ROOT / "css" / "fonts.css"
CSS_URL = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@700;800&family=Nunito:wght@700;800;900&display=swap"
KEEP = ("vietnamese", "latin-ext", "latin")
LICENSES = {
    "Baloo2": "https://raw.githubusercontent.com/google/fonts/main/ofl/baloo2/OFL.txt",
    "Nunito": "https://raw.githubusercontent.com/google/fonts/main/ofl/nunito/OFL.txt",
}
# a current desktop browser, so Google Fonts answers with woff2; nothing else about the machine is sent
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    css = get(CSS_URL).decode("utf-8")
    blocks = re.findall(r"/\*\s*([\w-]+)\s*\*/\s*(@font-face\s*\{[^}]*\})", css)
    FONTS.mkdir(parents=True, exist_ok=True)
    rules, saved, names_for = [], {}, {}
    for subset, block in blocks:
        if subset not in KEEP:
            continue
        family = re.search(r"font-family:\s*'([^']+)'", block).group(1)
        weight = re.search(r"font-weight:\s*(\d+)", block).group(1)
        url = re.search(r"url\((https://[^)]+)\)", block).group(1)
        if url not in saved:
            base = family.replace(" ", "") + "-" + subset
            n = names_for.get(base, 0)
            names_for[base] = n + 1
            # a variable font serves every weight from one file; a static one gets the weight in its name
            name = base + ("" if n == 0 else "-" + weight) + ".woff2"
            data = get(url)
            (FONTS / name).write_bytes(data)
            saved[url] = name
            print("  %-34s %6.1f KB" % (name, len(data) / 1024))
        rules.append("/* %s %s, %s */\n%s" % (family, weight, subset, block.replace(url, "../assets/fonts/" + saved[url])))
    for fam, url in LICENSES.items():
        (FONTS / ("OFL-%s.txt" % fam)).write_bytes(get(url))
    header = ("/* Baloo 2 and Nunito, served from this repo (tools/fetch_fonts.py): no network font request, so the web\n"
              "   build works offline and the Android app needs no Internet permission. SIL Open Font License, see\n"
              "   assets/fonts/OFL-*.txt. Each subset loads only when the page's text needs a character in its range. */\n")
    CSS_OUT.write_text(header + "\n".join(rules) + "\n", encoding="utf-8", newline="\n")
    total = sum(p.stat().st_size for p in FONTS.glob("*.woff2"))
    print("wrote %s (%d rules), %d font files, %.0f KB" % (CSS_OUT.relative_to(ROOT), len(rules), len(saved), total / 1024))


if __name__ == "__main__":
    main()
