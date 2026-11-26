package br.maredelinha.pesca;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ORIGIN = "https://" + HOST;
    private static final int LOCATION = 17;
    private WebView web;
    private GeolocationPermissions.Callback pendingLocation;
    private String pendingOrigin;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(16, 45, 57));
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (!isLocal(url)) return null;
                String path = url.getPath();
                if (path == null || !path.matches("/(index\\.html|app\\.js|(?:style|guide)\\.css|static/[a-zA-Z0-9.-]+)")) {
                    return missing();
                }
                try {
                    String mime = mimeType(path);
                    String encoding = mime.startsWith("text/") || mime.equals("application/javascript") ? "UTF-8" : null;
                    return new WebResourceResponse(mime, encoding, getAssets().open(path.substring(1)));
                } catch (IOException error) {
                    return missing();
                }
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (isLocal(url)) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(url.getScheme())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE));
                    } catch (ActivityNotFoundException ignored) {
                        Toast.makeText(MainActivity.this, "Navegador indisponível.", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback result) {
                if (!ORIGIN.equals(origin) && !(ORIGIN + "/").equals(origin)) {
                    result.invoke(origin, false, false);
                } else if (canLocate()) {
                    result.invoke(origin, true, false);
                } else if (pendingLocation == null) {
                    pendingOrigin = origin;
                    pendingLocation = result;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION);
                } else {
                    result.invoke(origin, false, false);
                }
            }
        });
        setContentView(web);
        web.loadUrl(ORIGIN + "/index.html");
    }

    private boolean canLocate() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == LOCATION && pendingLocation != null) {
            pendingLocation.invoke(pendingOrigin, canLocate(), false);
            pendingLocation = null;
            pendingOrigin = null;
        }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("!window.dispatchEvent(new Event('mare-back',{cancelable:true}))", handled -> {
            if (!"true".equals(handled)) finish();
        });
    }

    @Override protected void onDestroy() {
        if (pendingLocation != null) {
            pendingLocation.invoke(pendingOrigin, false, false);
            pendingLocation = null;
        }
        if (web != null) web.destroy();
        super.onDestroy();
    }

    private static boolean isLocal(Uri url) {
        return "https".equals(url.getScheme()) && HOST.equals(url.getHost()) && url.getPort() == -1;
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeType(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".js")) return "application/javascript";
        if (path.endsWith(".webp")) return "image/webp";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }
}
