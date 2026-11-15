"""Build the Android APK of Jelly Tangle.

The app is the web game (index.html, css/, js/, assets/) inside one full-screen WebView (android/). It is built with
the Android SDK's own command-line tools, so there is no Gradle project and nothing is downloaded:

    aapt2 compile + link   resources, manifest and the game files -> base APK (+ R.java)
    javac                  MainActivity.java + R.java, against the platform's android.jar
    d8                     .class -> classes.dex
    zipalign + apksigner   align and sign

Usage (from anywhere):

    python tools/android/build_apk.py                  # debug-signed, for testing and sharing by hand
    python tools/android/build_apk.py --release        # signed with your own key (see --help)

The SDK and JDK are found from ANDROID_HOME / ANDROID_SDK_ROOT and JAVA_HOME, or else from a Unity editor that has
Android support installed (C:\\Program Files\\Unity\\Hub\\Editor\\<version>\\...\\AndroidPlayer). Output goes to
dist/JellyTangle-<version>.apk. The debug key is kept in tools/android/keys/ (git-ignored) and reused, so a new build
installs over the previous one without uninstalling.
"""
import argparse
import os
import pathlib
import shutil
import subprocess
import sys
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
ANDROID = ROOT / "android"
BUILD = ROOT / "tools" / "android" / "build"
KEYS = ROOT / "tools" / "android" / "keys"
DIST = ROOT / "dist"

APP_ID = "vn.sonat.jellytangle"
VERSION_CODE = 5
VERSION_NAME = "1.1.1"
MIN_SDK = 26          # Android 8.0: adaptive vector icons, no bitmap fallbacks needed
TARGET_SDK = 35       # Android 15
WEB_FILES = ["index.html", "manifest.webmanifest", "css", "js", "assets"]


def die(msg):
    print("error: " + msg, file=sys.stderr)
    sys.exit(1)


def version_key(name):
    out = []
    for part in name.replace("-", ".").split("."):
        out.append(int(part) if part.isdigit() else -1)
    return out


def newest(folder):
    dirs = [d for d in folder.iterdir() if d.is_dir()] if folder.is_dir() else []
    return max(dirs, key=lambda d: version_key(d.name)) if dirs else None


def unity_android_players():
    hubs = [pathlib.Path(r"C:\Program Files\Unity\Hub\Editor"), pathlib.Path("/Applications/Unity/Hub/Editor"),
            pathlib.Path.home() / "Unity" / "Hub" / "Editor"]
    found = []
    for hub in hubs:
        if hub.is_dir():
            for ed in sorted(hub.iterdir(), key=lambda d: version_key(d.name), reverse=True):
                for player in (ed / "Editor" / "Data" / "PlaybackEngines" / "AndroidPlayer",
                               ed / "PlaybackEngines" / "AndroidPlayer"):
                    if player.is_dir():
                        found.append(player)
    return found


def find_sdk():
    for var in ("ANDROID_HOME", "ANDROID_SDK_ROOT"):
        p = os.environ.get(var)
        if p and (pathlib.Path(p) / "build-tools").is_dir():
            return pathlib.Path(p)
    local = pathlib.Path(os.environ.get("LOCALAPPDATA", "")) / "Android" / "Sdk"
    if (local / "build-tools").is_dir():
        return local
    for player in unity_android_players():
        if (player / "SDK" / "build-tools").is_dir():
            return player / "SDK"
    die("no Android SDK found: set ANDROID_HOME, or install Android support in Unity Hub")


def find_jdk():
    exe = ".exe" if os.name == "nt" else ""
    p = os.environ.get("JAVA_HOME")
    if p and (pathlib.Path(p) / "bin" / ("javac" + exe)).is_file():
        return pathlib.Path(p)
    for player in unity_android_players():
        if (player / "OpenJDK" / "bin" / ("javac" + exe)).is_file():
            return player / "OpenJDK"
    die("no JDK found: set JAVA_HOME (JDK 17), or install Android support in Unity Hub")


def run(cmd, env=None):
    printable = " ".join(str(c) for c in cmd)
    print("  $ " + (printable if len(printable) < 160 else printable[:157] + "..."))
    r = subprocess.run([str(c) for c in cmd], env=env, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stdout.write(r.stdout)
        sys.stderr.write(r.stderr)
        die("command failed: " + str(cmd[0]))
    return r.stdout


def main():
    ap = argparse.ArgumentParser(description="Build the Jelly Tangle APK.")
    ap.add_argument("--release", action="store_true",
                    help="sign with your own key: set JT_KEYSTORE, JT_KEY_ALIAS, JT_STORE_PASS and JT_KEY_PASS")
    ap.add_argument("--platform", type=int, default=TARGET_SDK, help="android.jar API level to compile against")
    args = ap.parse_args()

    sdk, jdk = find_sdk(), find_jdk()
    bt = newest(sdk / "build-tools")
    platform = sdk / "platforms" / ("android-%d" % args.platform)
    if not (platform / "android.jar").is_file():
        platform = newest(sdk / "platforms")
    android_jar = platform / "android.jar"
    exe = ".exe" if os.name == "nt" else ""
    java, javac, keytool = (jdk / "bin" / (n + exe) for n in ("java", "javac", "keytool"))
    aapt2, zipalign = bt / ("aapt2" + exe), bt / ("zipalign" + exe)
    d8_jar, apksigner_jar = bt / "lib" / "d8.jar", bt / "lib" / "apksigner.jar"
    for tool in (aapt2, zipalign, d8_jar, apksigner_jar, android_jar, java, javac):
        if not tool.exists():
            die("missing " + str(tool))
    print("SDK      " + str(sdk))
    print("tools    build-tools " + bt.name + ", " + platform.name + ", JDK " + str(jdk))

    shutil.rmtree(BUILD, ignore_errors=True)
    for d in ("assets/www", "gen", "classes", "dex"):
        (BUILD / d).mkdir(parents=True, exist_ok=True)

    print("1/6 game files")
    www = BUILD / "assets" / "www"
    for name in WEB_FILES:
        src = ROOT / name
        if src.is_dir():
            shutil.copytree(src, www / name)
        else:
            shutil.copy2(src, www / name)

    print("2/6 resources")
    res_zip = BUILD / "res.zip"
    run([aapt2, "compile", "--dir", ANDROID / "res", "-o", res_zip])
    base_apk = BUILD / "base.apk"
    run([aapt2, "link", "-o", base_apk, "-I", android_jar, "--manifest", ANDROID / "AndroidManifest.xml",
         "-A", BUILD / "assets", "--java", BUILD / "gen", "--rename-manifest-package", APP_ID,
         "--min-sdk-version", MIN_SDK, "--target-sdk-version", TARGET_SDK,
         "--version-code", VERSION_CODE, "--version-name", VERSION_NAME, "--auto-add-overlay", res_zip])

    print("3/6 compile")
    sources = sorted(str(p) for p in (ANDROID / "src").rglob("*.java")) + sorted(str(p) for p in (BUILD / "gen").rglob("*.java"))
    run([javac, "-source", "8", "-target", "8", "-bootclasspath", android_jar, "-classpath", android_jar,
         "-encoding", "UTF-8", "-Xlint:-options", "-nowarn", "-d", BUILD / "classes"] + sources)

    print("4/6 dex")
    classes = sorted(str(p) for p in (BUILD / "classes").rglob("*.class"))
    run([java, "-cp", d8_jar, "com.android.tools.r8.D8", "--release", "--min-api", MIN_SDK, "--lib", android_jar,
         "--output", BUILD / "dex"] + classes)
    with zipfile.ZipFile(base_apk, "a", compression=zipfile.ZIP_DEFLATED) as z:
        z.write(BUILD / "dex" / "classes.dex", "classes.dex")

    print("5/6 align")
    aligned = BUILD / "aligned.apk"
    run([zipalign, "-f", "-p", "4", base_apk, aligned])

    print("6/6 sign")
    if args.release:
        need = ("JT_KEYSTORE", "JT_KEY_ALIAS", "JT_STORE_PASS", "JT_KEY_PASS")
        missing = [v for v in need if not os.environ.get(v)]
        if missing:
            die("--release needs " + ", ".join(missing))
        ks, alias = os.environ["JT_KEYSTORE"], os.environ["JT_KEY_ALIAS"]
        # passwords travel through the environment, never the command line
        sign_env = dict(os.environ)
        store_pass, key_pass = "env:JT_STORE_PASS", "env:JT_KEY_PASS"
        suffix = ""
    else:
        KEYS.mkdir(parents=True, exist_ok=True)
        ks, alias = KEYS / "debug.keystore", "androiddebugkey"
        if not ks.exists():
            run([keytool, "-genkeypair", "-keystore", ks, "-storepass", "android", "-keypass", "android", "-alias", alias,
                 "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000", "-dname", "CN=Android Debug,O=Android,C=US"])
        sign_env, store_pass, key_pass, suffix = None, "pass:android", "pass:android", "-debug"
    DIST.mkdir(exist_ok=True)
    out = DIST / ("JellyTangle-%s%s.apk" % (VERSION_NAME, suffix))
    run([java, "-jar", apksigner_jar, "sign", "--ks", ks, "--ks-key-alias", alias, "--ks-pass", store_pass,
         "--key-pass", key_pass, "--out", out, aligned], env=sign_env)
    run([java, "-jar", apksigner_jar, "verify", out])

    badging = run([aapt2, "dump", "badging", out])
    first = badging.splitlines()[0] if badging else ""
    size_kb = out.stat().st_size / 1024
    print("\nbuilt  " + str(out.relative_to(ROOT)) + "  (%.0f KB)" % size_kb)
    print("       " + first)


if __name__ == "__main__":
    main()
