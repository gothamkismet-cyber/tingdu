package local.tingdu.learner;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Hosts the 听读 web app and gives it what a browser tab lacks on Android: a durable learning file,
 * the system text-to-speech engine, document pickers for backups, and microphone permission.
 * The page talks to {@link Bridge} as window.TingduAndroid; answers come back as JSON strings and
 * asynchronous results arrive as "tingdu:native" events on window.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + HOST + "/index.html";
    private static final int OPEN_FILE = 1, SAVE_FILE = 2, MICROPHONE = 3;
    private static final int SPEECH_STARTING = 0, SPEECH_READY = 1, SPEECH_FAILED = 2;
    private static final int STATE_LIMIT = 10 * 1024 * 1024;
    private static final Map<String, String> TYPES = new HashMap<>();
    static {
        TYPES.put("html", "text/html");
        TYPES.put("js", "text/javascript");
        TYPES.put("css", "text/css");
        TYPES.put("svg", "image/svg+xml");
        TYPES.put("json", "application/json");
        TYPES.put("png", "image/png");
    }

    private final Object storeLock = new Object();
    private WebView web;
    private OnlineBridge online;
    private TextToSpeech speech;
    private volatile int speechState = SPEECH_STARTING;
    private int speechGeneration;
    private ValueCallback<Uri[]> pendingChooser;
    private PermissionRequest pendingMicrophone;
    private String pendingExport;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        online = new OnlineBridge(this, this::emit);
        web.setBackgroundColor(Color.TRANSPARENT);
        setContentView(web);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setSupportZoom(false);
        web.addJavascriptInterface(new Bridge(), "TingduAndroid");
        web.setWebViewClient(new AppClient());
        web.setWebChromeClient(new ChromeClient());
        startSpeech();
        if (saved == null || web.restoreState(saved) == null) web.loadUrl(HOME);
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        // Voice data may have been installed in system settings while the app was in the background.
        if (speechState == SPEECH_READY) emit(json("type", "voices", "ready", true));
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        online.close();
        if (speech != null) speech.shutdown();
        if (pendingMicrophone != null) pendingMicrophone.deny();
        web.destroy();
        web = null;
        super.onDestroy();
    }

    // The page closes dialogs and returns to practice first; only then does the app go to the background.
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.tingduHandleBack ? window.tingduHandleBack() : false", value -> {
            if (!"true".equals(value)) moveTaskToBack(true);
        });
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] results) {
        if (code != MICROPHONE || pendingMicrophone == null) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) pendingMicrophone.grant(pendingMicrophone.getResources());
        else pendingMicrophone.deny();
        pendingMicrophone = null;
    }

    @Override
    protected void onActivityResult(int code, int result, Intent data) {
        if (code == OPEN_FILE) {
            if (pendingChooser != null) pendingChooser.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
            pendingChooser = null;
        } else if (code == SAVE_FILE) {
            final String text = pendingExport;
            pendingExport = null;
            final Uri target = result == RESULT_OK && data != null ? data.getData() : null;
            if (target == null || text == null) {
                emit(json("type", "file", "ok", false, "cancelled", true));
                return;
            }
            new Thread(() -> {
                boolean ok;
                try (OutputStream out = getContentResolver().openOutputStream(target)) {
                    if (out == null) throw new IOException("No output stream");
                    out.write(text.getBytes(StandardCharsets.UTF_8));
                    ok = true;
                } catch (Exception error) {
                    ok = false;
                }
                emit(json("type", "file", "ok", ok, "cancelled", false));
            }).start();
        } else {
            super.onActivityResult(code, result, data);
        }
    }

    private void startSpeech() {
        final int generation = ++speechGeneration;
        speechState = SPEECH_STARTING;
        speech = new TextToSpeech(getApplicationContext(), status -> {
            if (generation != speechGeneration) return;
            speechState = status == TextToSpeech.SUCCESS ? SPEECH_READY : SPEECH_FAILED;
            emit(json("type", "voices", "ready", true));
        });
        speech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { emit(json("type", "speech", "id", id, "ok", true)); }
            @Override public void onError(String id) { emit(json("type", "speech", "id", id, "ok", false)); }
            @Override public void onError(String id, int code) { onError(id); }
            @Override public void onStop(String id, boolean interrupted) { emit(json("type", "speech", "id", id, "ok", false)); }
        });
    }

    private void restartSpeech() {
        if (speech != null) speech.shutdown();
        startSpeech();
    }

    /** Lists English and Japanese voices whose data is installed: offline first, then the usual region, then quality. */
    private JSONArray collectVoices(TextToSpeech engine) {
        JSONArray list = new JSONArray();
        List<Voice> found = new ArrayList<>();
        String preferred = "";
        try {
            Voice fallback = engine.getDefaultVoice();
            if (fallback != null) preferred = fallback.getName();
            Set<Voice> voices = engine.getVoices();
            if (voices != null) for (Voice voice : voices) {
                String language = voice.getLocale().getLanguage();
                Set<String> features = voice.getFeatures();
                boolean installed = features == null || !features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
                if (installed && (language.equals("en") || language.equals("ja"))) found.add(voice);
            }
        } catch (RuntimeException ignored) {
        }
        final String engineDefault = preferred;
        Collections.sort(found, (a, b) -> {
            if (a.isNetworkConnectionRequired() != b.isNetworkConnectionRequired()) return a.isNetworkConnectionRequired() ? 1 : -1;
            if (a.getName().equals(engineDefault) != b.getName().equals(engineDefault)) return a.getName().equals(engineDefault) ? -1 : 1;
            boolean usualA = isUsualRegion(a.getLocale()), usualB = isUsualRegion(b.getLocale());
            if (usualA != usualB) return usualA ? -1 : 1;
            if (a.getQuality() != b.getQuality()) return b.getQuality() - a.getQuality();
            return a.getName().compareTo(b.getName());
        });
        Set<String> languages = new HashSet<>();
        for (Voice voice : found) {
            languages.add(voice.getLocale().getLanguage());
            list.put(voiceJson(voice.getName(), voice.getLocale().toLanguageTag(), !voice.isNetworkConnectionRequired()));
        }
        // Some engines speak a language without listing named voices; offer it through its locale instead.
        for (String tag : new String[]{"en-US", "ja-JP"}) {
            Locale locale = Locale.forLanguageTag(tag);
            try {
                if (!languages.contains(locale.getLanguage()) && engine.isLanguageAvailable(locale) >= TextToSpeech.LANG_AVAILABLE) list.put(voiceJson("locale:" + tag, tag, true));
            } catch (RuntimeException ignored) {
            }
        }
        return list;
    }

    private static boolean isUsualRegion(Locale locale) {
        return locale.getLanguage().equals("en") ? "US".equals(locale.getCountry()) : "JP".equals(locale.getCountry());
    }

    private static JSONObject voiceJson(String name, String lang, boolean local) {
        JSONObject voice = new JSONObject();
        try {
            voice.put("name", name);
            voice.put("lang", lang);
            voice.put("localService", local);
        } catch (Exception ignored) {
        }
        return voice;
    }

    private void emit(String detail) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript("window.dispatchEvent(new CustomEvent('tingdu:native',{detail:" + detail + "}))", null);
        });
    }

    private static String json(Object... pairs) {
        JSONObject object = new JSONObject();
        try {
            for (int i = 0; i < pairs.length; i += 2) object.put((String) pairs[i], pairs[i + 1]);
        } catch (Exception ignored) {
        }
        return object.toString();
    }

    private static byte[] read(InputStream in) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[16384];
        for (int count; (count = in.read(buffer)) != -1; ) out.write(buffer, 0, count);
        return out.toByteArray();
    }

    private static void copy(File from, File to) throws IOException {
        try (InputStream in = new FileInputStream(from); FileOutputStream out = new FileOutputStream(to)) {
            out.write(read(in));
            out.getFD().sync();
        }
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, new ByteArrayInputStream(new byte[0]));
    }

    /** Serves the bundled page (flat files in assets/) on a secure origin, so ES modules, storage and crypto all work. */
    private final class AppClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            String scheme = url.getScheme();
            if (!"http".equals(scheme) && !"https".equals(scheme)) return null;
            // Remote data uses the explicit native bridge; remote pages/scripts cannot enter this WebView.
            if (!"https".equals(scheme) || !HOST.equals(url.getHost())) return missing();
            String path = url.getPath();
            if (path == null || path.isEmpty() || path.equals("/")) path = "/index.html";
            String type = TYPES.get(path.substring(path.lastIndexOf('.') + 1));
            if (type == null || path.lastIndexOf('/') != 0 || !"GET".equals(request.getMethod())) return missing();
            try {
                Map<String, String> headers = new HashMap<>();
                headers.put("Cache-Control", "no-cache");
                headers.put("X-Content-Type-Options", "nosniff");
                return new WebResourceResponse(type, "utf-8", 200, "OK", headers, getAssets().open(path.substring(1)));
            } catch (IOException error) {
                return missing();
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri=request.getUrl();
            if(request.isForMainFrame() && request.hasGesture() && "https".equals(uri.getScheme())
                    && ((Arrays.asList("en.wikipedia.org","ja.wikipedia.org").contains(uri.getHost()) && uri.getPath()!=null && uri.getPath().startsWith("/wiki/"))
                        || ("creativecommons.org".equals(uri.getHost()) && "/licenses/by-sa/4.0/".equals(uri.getPath())))
                    && uri.getUserInfo()==null && uri.getPort()==-1) {
                try { startActivity(new Intent(Intent.ACTION_VIEW,uri)); } catch(ActivityNotFoundException ignored) {}
            }
            return !HOST.equals(request.getUrl().getHost());
        }
    }

    private final class ChromeClient extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (pendingChooser != null) pendingChooser.onReceiveValue(null);
            pendingChooser = callback;
            // Many file managers label .json backups as generic files, so the page validates the content instead.
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
            try {
                startActivityForResult(intent, OPEN_FILE);
                return true;
            } catch (ActivityNotFoundException error) {
                pendingChooser = null;
                return false;
            }
        }

        @Override
        public void onPermissionRequest(PermissionRequest request) {
            runOnUiThread(() -> {
                boolean microphoneOnly = HOST.equals(request.getOrigin().getHost())
                        && Arrays.equals(request.getResources(), new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                if (!microphoneOnly) {
                    request.deny();
                } else if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(request.getResources());
                } else {
                    if (pendingMicrophone != null) pendingMicrophone.deny();
                    pendingMicrophone = request;
                    requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE);
                }
            });
        }
    }

    /** Methods run on the WebView's bridge thread; anything that touches views is posted to the UI thread. */
    private final class Bridge {
        @JavascriptInterface public String online(String id,String raw) { return online.request(id,raw); }
        @JavascriptInterface public void cancelOnline(String id) { online.cancel(id); }
        @JavascriptInterface public String loadAIProfile() { return online.loadProfile(); }
        @JavascriptInterface public String saveAIProfile(String raw) { return online.saveProfile(raw); }
        @JavascriptInterface
        public String loadState() {
            synchronized (storeLock) {
                File file = new File(getFilesDir(), "learning.json");
                if (!file.exists()) return json("exists", false, "raw", JSONObject.NULL);
                if (file.length() > STATE_LIMIT) return json("error", "学习数据超过读取限制");
                try (InputStream in = new FileInputStream(file)) {
                    return json("exists", true, "raw", new String(read(in), StandardCharsets.UTF_8));
                } catch (IOException error) {
                    return json("error", "本机学习文件无法读取");
                }
            }
        }

        // Writes a complete copy first and swaps it in, keeping the previous file, like the desktop store.
        @JavascriptInterface
        public String saveState(String raw) {
            if (raw == null || raw.length() > STATE_LIMIT || !raw.startsWith("{")) return json("error", "学习数据过大或格式不正确");
            synchronized (storeLock) {
                File directory = getFilesDir(), file = new File(directory, "learning.json"), next = new File(directory, "learning.next.json");
                try {
                    try (FileOutputStream out = new FileOutputStream(next)) {
                        out.write(raw.getBytes(StandardCharsets.UTF_8));
                        out.getFD().sync();
                    }
                    if (file.exists()) copy(file, new File(directory, "learning.previous.json"));
                    if (!next.renameTo(file)) throw new IOException("Rename failed");
                    return json("saved", true);
                } catch (IOException error) {
                    return json("error", "学习文件没有写入成功");
                }
            }
        }

        @JavascriptInterface
        public String info() {
            String version = "";
            try {
                version = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (PackageManager.NameNotFoundException ignored) {
            }
            return json("version", version, "dataDirectory", getFilesDir().getAbsolutePath(), "platform", "android");
        }

        @JavascriptInterface
        public String voices(boolean refresh) {
            if (refresh) {
                speechState = SPEECH_STARTING;
                runOnUiThread(MainActivity.this::restartSpeech);
                return json("ready", false, "voices", new JSONArray());
            }
            TextToSpeech engine = speech;
            JSONArray list = speechState == SPEECH_READY && engine != null ? collectVoices(engine) : new JSONArray();
            return json("ready", speechState != SPEECH_STARTING, "voices", list);
        }

        @JavascriptInterface
        public String speak(String request) {
            try {
                JSONObject input = new JSONObject(request);
                String id = input.getString("id"), language = input.getString("language"), name = input.getString("voice"), text = input.getString("text");
                double rate = input.getDouble("rate");
                TextToSpeech engine = speech;
                if (engine == null || speechState != SPEECH_READY || !(language.equals("en") || language.equals("ja"))
                        || text.trim().isEmpty() || text.length() > 300 || rate < 0.5 || rate > 1.5) return json("ok", false);
                if (name.startsWith("locale:")) {
                    Locale locale = Locale.forLanguageTag(name.substring("locale:".length()));
                    if (!locale.getLanguage().equals(language) || engine.setLanguage(locale) < TextToSpeech.LANG_AVAILABLE) return json("ok", false);
                } else {
                    Voice match = null;
                    for (Voice voice : engine.getVoices()) if (voice.getName().equals(name)) match = voice;
                    // Never read a question with a voice from the other language.
                    if (match == null || !match.getLocale().getLanguage().equals(language) || engine.setVoice(match) != TextToSpeech.SUCCESS) return json("ok", false);
                }
                engine.setSpeechRate((float) rate);
                return json("ok", engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.SUCCESS);
            } catch (Exception error) {
                return json("ok", false);
            }
        }

        @JavascriptInterface
        public void stopSpeech() {
            TextToSpeech engine = speech;
            if (engine != null) engine.stop();
        }

        @JavascriptInterface
        public String saveFile(String name, String text) {
            if (text == null || text.length() > STATE_LIMIT) return json("error", "导出内容过大");
            final String title = name == null || name.trim().isEmpty() ? "tingdu-backup.json" : name.replaceAll("[\\\\/:*?\"<>|]", "_");
            runOnUiThread(() -> {
                pendingExport = text;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("application/json").putExtra(Intent.EXTRA_TITLE, title);
                try {
                    startActivityForResult(intent, SAVE_FILE);
                } catch (ActivityNotFoundException error) {
                    pendingExport = null;
                    emit(json("type", "file", "ok", false, "cancelled", false));
                }
            });
            return json("started", true);
        }

        @JavascriptInterface
        public String openSpeechSettings() {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent("com.android.settings.TTS_SETTINGS"));
                } catch (ActivityNotFoundException error) {
                    try {
                        startActivity(new Intent(Settings.ACTION_SETTINGS));
                    } catch (ActivityNotFoundException ignored) {
                    }
                }
            });
            return json("opened", true);
        }

        @JavascriptInterface
        public void setSystemBars(String status, String navigation, boolean dark) {
            runOnUiThread(() -> {
                try {
                    Window window = getWindow();
                    window.setStatusBarColor(Color.parseColor(status));
                    window.setNavigationBarColor(Color.parseColor(navigation));
                    if (Build.VERSION.SDK_INT >= 30) {
                        WindowInsetsController controller = window.getInsetsController();
                        int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                        if (controller != null) controller.setSystemBarsAppearance(dark ? 0 : light, light);
                    } else {
                        View decor = window.getDecorView();
                        int light = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | (Build.VERSION.SDK_INT >= 26 ? View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR : 0);
                        int flags = decor.getSystemUiVisibility();
                        decor.setSystemUiVisibility(dark ? flags & ~light : flags | light);
                    }
                } catch (IllegalArgumentException ignored) {
                }
            });
        }
    }
}
