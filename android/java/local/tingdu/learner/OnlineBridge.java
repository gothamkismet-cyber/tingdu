package local.tingdu.learner;

import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Optional, user-initiated HTTPS requests. The WebView itself cannot load remote content. */
final class OnlineBridge {
    interface Events { void emit(String detail); }
    private final Events events;
    private final AtomicFile profile;
    private final ExecutorService workers = Executors.newFixedThreadPool(2);
    private final ScheduledExecutorService timers = Executors.newSingleThreadScheduledExecutor();
    private final ConcurrentHashMap<String, Task> tasks = new ConcurrentHashMap<>();
    private volatile boolean closed;
    private static final String KEY_ALIAS = "tingdu-ai-connection-v1";
    private static final class Task {
        volatile boolean cancelled;
        volatile HttpURLConnection connection;
        void cancel() { cancelled = true; HttpURLConnection c = connection; if (c != null) c.disconnect(); }
    }
    OnlineBridge(Context context, Events events) {
        this.events = events;
        profile = new AtomicFile(new File(context.getNoBackupFilesDir(), "ai-provider.enc"));
    }
    private static String result(Object... pairs) {
        JSONObject reply = new JSONObject();
        try { for (int i=0; i<pairs.length; i+=2) reply.put((String)pairs[i], pairs[i+1]); } catch (Exception ignored) {}
        return reply.toString();
    }
    private static String text(JSONObject object, String key, int max) throws Exception {
        Object raw = object.opt(key);
        if (!(raw instanceof String)) throw new Exception();
        String value = ((String)raw).trim();
        if (value.isEmpty() || value.length()>max || value.matches("(?s).*[\\x00-\\x1f].*")) throw new Exception();
        return value;
    }
    private static JSONObject config(JSONObject input) throws Exception {
        String base = text(input,"baseUrl",500).replaceAll("/+$", "");
        URI uri = new URI(base);
        if (!"https".equals(uri.getScheme()) || uri.getHost()==null || uri.getRawUserInfo()!=null || uri.getRawQuery()!=null || uri.getRawFragment()!=null || uri.getPath().toLowerCase().endsWith("/chat/completions")) throw new Exception();
        String key = text(input,"apiKey",4096);
        if (key.matches("(?s).*\\s.*")) throw new Exception();
        JSONObject clean = new JSONObject();
        clean.put("baseUrl",base); clean.put("apiKey",key); clean.put("model",text(input,"model",120)); clean.put("voice",text(input,"voice",80));
        return clean;
    }
    private static byte[] read(InputStream stream, int limit) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream(); byte[] buffer = new byte[16384];
        for (int count; (count=stream.read(buffer))!=-1;) {
            if (out.size()+count>limit) throw new Exception();
            out.write(buffer,0,count);
        }
        return out.toByteArray();
    }
    String request(String id, String raw) {
        if (closed || id==null || !id.matches("[\\w-]{1,80}") || raw==null || raw.length()>4*1024*1024 || tasks.size()>=4) return result("error","请求过多或过大，请稍后重试。");
        Task task = new Task();
        if (tasks.putIfAbsent(id,task)!=null) return result("error","请求编号重复。");
        workers.execute(() -> perform(id,raw,task));
        return result("started",true);
    }
    private void perform(String id, String raw, Task task) {
        ScheduledFuture<?> deadline = null;
        try {
            JSONObject request = new JSONObject(raw), settings = null;
            String kind = request.optString("kind"), address; byte[] payload = null;
            int timeout, limit;
            if ("ai".equals(kind)) {
                settings = config(request.getJSONObject("config"));
                JSONObject body = request.getJSONObject("body"); JSONArray messages = body.getJSONArray("messages");
                if (!settings.getString("model").equals(body.getString("model")) || !Boolean.FALSE.equals(body.opt("stream")) || messages.length()>14) throw new Exception();
                payload = body.toString().getBytes(StandardCharsets.UTF_8);
                if (payload.length>3*1024*1024) throw new Exception();
                address = settings.getString("baseUrl")+"/chat/completions"; timeout=60000; limit=18*1024*1024;
            } else if ("wiki".equals(kind)) {
                String language = request.optString("language");
                if (!"en".equals(language) && !"ja".equals(language)) throw new Exception();
                String base = "https://"+language+".wikipedia.org";
                if (request.has("title")) address=base+"/api/rest_v1/page/summary/"+URLEncoder.encode(text(request,"title",200),"UTF-8").replace("+","%20");
                else address=base+"/w/rest.php/v1/search/page?q="+URLEncoder.encode(text(request,"query",100),"UTF-8")+"&limit=5";
                timeout=15000; limit=512*1024;
            } else throw new Exception();
            if (task.cancelled) return;
            HttpURLConnection connection = (HttpURLConnection)new URL(address).openConnection(); task.connection=connection;
            if (task.cancelled) return;
            connection.setInstanceFollowRedirects(false); connection.setConnectTimeout(timeout); connection.setReadTimeout(timeout);
            connection.setRequestProperty("Accept","application/json");
            if (settings!=null) connection.setRequestProperty("Authorization","Bearer "+settings.getString("apiKey"));
            else connection.setRequestProperty("User-Agent","Tingdu/2.5 (https://github.com/gothamkismet-cyber/tingdu)");
            deadline=timers.schedule(() -> { HttpURLConnection c=task.connection; if(c!=null)c.disconnect(); },timeout,TimeUnit.MILLISECONDS);
            if (payload!=null) {
                connection.setRequestMethod("POST"); connection.setRequestProperty("Content-Type","application/json");
                connection.setDoOutput(true); connection.setFixedLengthStreamingMode(payload.length);
                try(java.io.OutputStream out=connection.getOutputStream()){ out.write(payload); }
            }
            int status=connection.getResponseCode(); JSONObject reply=new JSONObject(); reply.put("status",status);
            if (status>=200 && status<300) {
                try(InputStream in=connection.getInputStream()) { reply.put("data",new JSONObject(new String(read(in,limit),StandardCharsets.UTF_8))); }
                reply.put("status",200);
            }
            if (!closed && !task.cancelled) events.emit(result("type","online","id",id,"result",reply));
        } catch(Exception ignored) {
            if (!closed && !task.cancelled) events.emit(result("type","online","id",id,"error","联网未完成，请检查 HTTPS 地址、网络、模型或回复格式后重试。"));
        } finally {
            if(deadline!=null)deadline.cancel(false);
            if(task.connection!=null)task.connection.disconnect();
            tasks.remove(id,task);
        }
    }
    void cancel(String id) { Task task=tasks.get(id); if(task!=null)task.cancel(); }
    void close() { closed=true; for(Task task:tasks.values())task.cancel(); workers.shutdownNow(); timers.shutdownNow(); }

    private SecretKey key() throws Exception {
        KeyStore store=KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (!store.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator=KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES,"AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT)
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).build());
            return generator.generateKey();
        }
        return (SecretKey)store.getKey(KEY_ALIAS,null);
    }
    synchronized String loadProfile() {
        try { key(); } catch(Exception ignored) { return result("available",false,"profile",JSONObject.NULL); }
        if(!profile.getBaseFile().exists())return result("available",true,"profile",JSONObject.NULL);
        try(FileInputStream in=profile.openRead()) {
            byte[] bytes=read(in,16000); if(bytes.length<29)throw new Exception();
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Arrays.copyOfRange(bytes,0,12)));
            JSONObject value=config(new JSONObject(new String(cipher.doFinal(Arrays.copyOfRange(bytes,12,bytes.length)),StandardCharsets.UTF_8)));
            return result("available",true,"profile",value);
        } catch(Exception ignored) { return result("available",true,"profile",JSONObject.NULL,"error","保存的 AI 连接无法解密，请重新填写。"); }
    }
    synchronized String saveProfile(String raw) {
        if("null".equals(raw)){profile.delete();return result("saved",false);}
        FileOutputStream out=null;
        try {
            if(raw==null || raw.length()>12000)throw new Exception();
            JSONObject value=config(new JSONObject(raw));
            Cipher cipher=Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE,key());
            byte[] iv=cipher.getIV(); if(iv.length!=12)throw new Exception();
            out=profile.startWrite(); out.write(iv); out.write(cipher.doFinal(value.toString().getBytes(StandardCharsets.UTF_8))); profile.finishWrite(out);
            return result("saved",true);
        } catch(Exception ignored) { if(out!=null)profile.failWrite(out); return result("error","无法加密保存连接，请检查 HTTPS 地址或选择仅本次使用。"); }
    }
}
