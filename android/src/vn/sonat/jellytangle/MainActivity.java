package vn.sonat.jellytangle;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.Display;
import android.view.DisplayCutout;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;

/**
 * The whole app: one full-screen WebView running the web game from the APK's assets.
 *
 * The game is served from the assets under a fixed https address (appassets.androidplatform.net is reserved for
 * exactly this and never reaches the network), so the page has a stable origin: its save data in localStorage
 * survives updates, and it behaves exactly as the web build does.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/www/index.html";
    /** Same pink as the web boot screen, so splash, WebView and game hand over without a flash. */
    private static final int BOOT_COLOR = 0xFFFF86B8;

    private WebView web;
    private int insetTop, insetBottom;   // display cutout, in CSS pixels

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) {
            // draw under the camera cutout; the page keeps its HUD clear of it through --st / --sb (see pushInsets)
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }

        web = new WebView(this);
        web.setBackgroundColor(BOOT_COLOR);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setLongClickable(false);
        // no text-selection or "copy image" menus in a game (anonymous classes, not lambdas: android.jar has no
        // LambdaMetafactory for javac to target)
        web.setOnLongClickListener(new View.OnLongClickListener() {
            @Override public boolean onLongClick(View v) { return true; }
        });
        web.setHapticFeedbackEnabled(false);             // the game does its own vibration

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                    // localStorage: progress, coins, settings
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);                              // the layout is sized in its own units; ignore system font scale
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " JellyTangleApp/" + versionName());
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) WebView.setWebContentsDebuggingEnabled(true);

        web.setWebViewClient(new AssetClient());
        // window.JTNative for the page: native haptics (js/audio.js uses it when present). The WebView only ever
        // shows this app's own files (outside links open in the browser), so the bridge is not exposed to the web.
        web.addJavascriptInterface(new NativeBridge(), "JTNative");
        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                readInsets(insets);
                return insets;
            }
        });
        setContentView(web);
        hideSystemBars();
        preferFastestRefresh();
        web.loadUrl(START);
    }

    /**
     * A web page cannot ask for a refresh rate; an app can. Pick the display's fastest mode at the current
     * resolution (90 or 120 Hz on phones that have it): the game already animates by real elapsed time and its
     * frame meter lowers the canvas resolution if frames start arriving late.
     */
    private void preferFastestRefresh() {
        Display d = Build.VERSION.SDK_INT >= 30 ? getDisplay() : legacyDisplay();
        if (d == null) return;
        Display.Mode cur = d.getMode(), best = cur;
        for (Display.Mode m : d.getSupportedModes()) {
            if (m.getPhysicalWidth() == cur.getPhysicalWidth() && m.getPhysicalHeight() == cur.getPhysicalHeight()
                    && m.getRefreshRate() > best.getRefreshRate() + 0.5f) best = m;
        }
        if (best.getModeId() == cur.getModeId()) return;
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.preferredDisplayModeId = best.getModeId();
        lp.preferredRefreshRate = best.getRefreshRate();
        getWindow().setAttributes(lp);
    }

    @SuppressWarnings("deprecation")
    private Display legacyDisplay() {
        return getWindowManager().getDefaultDisplay();
    }

    // ---------- full screen ----------

    private void hideSystemBars() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
            WindowInsetsController c = window.getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            legacyImmersive(window.getDecorView());
        }
    }

    @SuppressWarnings("deprecation")
    private static void legacyImmersive(View decor) {
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** The camera cutout, handed to the page as the CSS variables its HUD already uses for safe areas. */
    private void readInsets(WindowInsets insets) {
        int top = 0, bottom = 0;
        if (Build.VERSION.SDK_INT >= 28) {
            DisplayCutout cut = insets.getDisplayCutout();
            if (cut != null) {
                top = cut.getSafeInsetTop();
                bottom = cut.getSafeInsetBottom();
            }
        }
        float density = getResources().getDisplayMetrics().density;
        int t = Math.round(top / density), b = Math.round(bottom / density);
        if (t != insetTop || b != insetBottom) {
            insetTop = t;
            insetBottom = b;
            pushInsets();
        }
    }

    private void pushInsets() {
        if (web == null) return;
        web.evaluateJavascript("(function(){var s=document.documentElement.style;"
                + "s.setProperty('--st','" + insetTop + "px');s.setProperty('--sb','" + insetBottom + "px');"
                + "window.dispatchEvent(new Event('resize'));})()", null);
    }

    // ---------- lifecycle ----------

    @Override
    protected void onPause() {
        super.onPause();
        if (web == null) return;
        web.onPause();          // the page sees visibilitychange: music stops, an open level pauses
        web.pauseTimers();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web == null) return;
        web.resumeTimers();
        web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.stopLoading();
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** Back: the game closes a popup or pauses the level; at the home screen the app goes to the background. */
    @SuppressWarnings("deprecation")
    @Override
    public void onBackPressed() {
        if (web == null) { moveTaskToBack(true); return; }
        web.evaluateJavascript("(window.JT&&JT.App&&JT.App.back)?JT.App.back():false", new ValueCallback<String>() {
            @Override public void onReceiveValue(String handled) {
                if (!"true".equals(handled)) moveTaskToBack(true);
            }
        });
    }

    // ---------- serving the game ----------

    private final class AssetClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
            Uri url = req.getUrl();
            if (!HOST.equals(url.getHost())) return null;      // e.g. Google Fonts: the normal network path
            String path = url.getPath();
            if (path == null) return missing();
            if (path.startsWith("/")) path = path.substring(1);
            if (path.isEmpty() || path.endsWith("/")) path += "index.html";
            try {
                InputStream in = getAssets().open(path);
                String mime = mimeOf(path);
                return new WebResourceResponse(mime, mime.startsWith("text/") || mime.endsWith("javascript") || mime.endsWith("json") ? "utf-8" : null, in);
            } catch (IOException e) {
                return missing();
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
            Uri url = req.getUrl();
            if (HOST.equals(url.getHost())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));   // any outside link opens in the browser
            } catch (ActivityNotFoundException ignored) {
                // no browser: stay in the game
            }
            return true;
        }

        @Override
        public void onPageFinished(WebView view, String url) {
            pushInsets();
        }

        /**
         * The page's renderer process died (Android usually kills it to free memory while the app is in the
         * background). Progress lives in localStorage, so rebuild the screen instead of letting the app crash.
         */
        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            if (view == web) web = null;
            ViewGroup parent = (ViewGroup) view.getParent();
            if (parent != null) parent.removeView(view);
            view.destroy();
            recreate();
            return true;
        }
    }

    // ---------- native haptics for the page ----------

    /** Exposed to the page as window.JTNative. Patterns use navigator.vibrate's format: "20" or "30,60,30". */
    private final class NativeBridge {
        @JavascriptInterface
        public void vibrate(String pattern) {
            Vibrator v = vibrator();
            if (v == null || !v.hasVibrator() || pattern == null) return;
            long[] on;
            try {
                String[] parts = pattern.split(",");
                on = new long[parts.length];
                for (int i = 0; i < parts.length; i++) on[i] = Math.max(0, Math.min(1000, Long.parseLong(parts[i].trim())));
            } catch (NumberFormatException e) {
                return;
            }
            if (on.length == 1) {
                long ms = on[0];
                if (ms <= 0) return;
                if (Build.VERSION.SDK_INT >= 29 && ms <= 20) {
                    // the system's own crisp tick and click, tuned per phone, instead of a short buzz
                    v.vibrate(VibrationEffect.createPredefined(ms <= 10 ? VibrationEffect.EFFECT_TICK : VibrationEffect.EFFECT_CLICK));
                } else {
                    v.vibrate(VibrationEffect.createOneShot(ms, strength(v, ms)));
                }
                return;
            }
            // navigator.vibrate alternates on, off, on...; Android's waveform starts with a pause
            long[] timings = new long[on.length + 1];
            int[] amps = new int[on.length + 1];
            for (int i = 0; i < on.length; i++) {
                timings[i + 1] = on[i];
                amps[i + 1] = i % 2 == 0 ? strength(v, on[i]) : 0;
            }
            v.vibrate(VibrationEffect.createWaveform(timings, amps, -1));
        }
    }

    /** Short buzzes are light, long ones strong (on phones that can vary the strength). */
    private static int strength(Vibrator v, long ms) {
        if (!v.hasAmplitudeControl()) return VibrationEffect.DEFAULT_AMPLITUDE;
        return (int) Math.max(70, Math.min(255, 60 + ms * 5));
    }

    private Vibrator vibrator() {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm == null ? null : vm.getDefaultVibrator();
        }
        return legacyVibrator();
    }

    @SuppressWarnings("deprecation")
    private Vibrator legacyVibrator() {
        return (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
    }

    private static WebResourceResponse missing() {
        WebResourceResponse r = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
        r.setStatusCodeAndReasonPhrase(404, "Not Found");
        return r;
    }

    private static String mimeOf(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".webmanifest")) return "application/manifest+json";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".woff")) return "font/woff";
        if (p.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "1";
        }
    }
}
