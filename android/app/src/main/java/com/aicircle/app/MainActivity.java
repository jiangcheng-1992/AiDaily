package com.aicircle.app;

import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.WebViewListener;

public class MainActivity extends BridgeActivity {
    private View launchLoadingView;
    private View fullScreenVideoView;
    private WebChromeClient.CustomViewCallback fullScreenVideoCallback;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        hardenWebView();
        installLaunchLoadingView();
        bindLaunchLoadingToWebView();
        mainHandler.postDelayed(this::hideLaunchLoadingView, 15000);
    }

    @Override
    public void onBackPressed() {
        if (fullScreenVideoView != null) {
            hideFullScreenVideoView();
            return;
        }

        if (bridge != null) {
            WebView webView = bridge.getWebView();
            if (webView != null && webView.canGoBack()) {
                webView.goBack();
                return;
            }
        }

        moveTaskToBack(true);
    }

    private void hardenWebView() {
        if (bridge == null) {
            return;
        }

        WebView webView = bridge.getWebView();
        if (webView == null) {
            return;
        }

        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings settings = webView.getSettings();
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        webView.setWebChromeClient(new AiCircleWebChromeClient(bridge));
    }

    private void installLaunchLoadingView() {
        FrameLayout rootView = findViewById(android.R.id.content);
        if (rootView == null || launchLoadingView != null) {
            return;
        }

        FrameLayout overlay = new FrameLayout(this);
        overlay.setClickable(true);
        overlay.setFocusable(true);
        overlay.setBackgroundColor(Color.rgb(248, 250, 252));

        LinearLayout content = new LinearLayout(this);
        content.setGravity(Gravity.CENTER);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(48, 48, 48, 48);

        ProgressBar progressBar = new ProgressBar(this);
        LinearLayout.LayoutParams progressParams = new LinearLayout.LayoutParams(72, 72);
        content.addView(progressBar, progressParams);

        TextView title = new TextView(this);
        title.setText("AI圈");
        title.setTextColor(Color.rgb(15, 23, 42));
        title.setTextSize(22);
        title.setGravity(Gravity.CENTER);
        title.setTypeface(title.getTypeface(), android.graphics.Typeface.BOLD);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleParams.topMargin = 28;
        content.addView(title, titleParams);

        TextView subtitle = new TextView(this);
        subtitle.setText("正在加载 AI 圈新动态...");
        subtitle.setTextColor(Color.rgb(100, 116, 139));
        subtitle.setTextSize(14);
        subtitle.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subtitleParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        subtitleParams.topMargin = 10;
        content.addView(subtitle, subtitleParams);

        FrameLayout.LayoutParams contentParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.CENTER
        );
        overlay.addView(content, contentParams);

        rootView.addView(
            overlay,
            new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        );
        launchLoadingView = overlay;
    }

    private void bindLaunchLoadingToWebView() {
        if (bridge == null) {
            return;
        }

        bridge.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    hideLaunchLoadingView();
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    hideLaunchLoadingView();
                }

                @Override
                public void onReceivedError(WebView webView) {
                    hideLaunchLoadingView();
                }

                @Override
                public void onReceivedHttpError(WebView webView) {
                    hideLaunchLoadingView();
                }
            }
        );
    }

    private void hideLaunchLoadingView() {
        if (launchLoadingView == null) {
            return;
        }

        launchLoadingView.animate()
            .alpha(0f)
            .setDuration(180)
            .withEndAction(
                () -> {
                    ViewGroup parent = (ViewGroup) launchLoadingView.getParent();
                    if (parent != null) {
                        parent.removeView(launchLoadingView);
                    }
                    launchLoadingView = null;
                }
            )
            .start();
    }

    private class AiCircleWebChromeClient extends BridgeWebChromeClient {
        AiCircleWebChromeClient(Bridge bridge) {
            super(bridge);
        }

        @Override
        public void onShowCustomView(View view, WebChromeClient.CustomViewCallback callback) {
            if (fullScreenVideoView != null) {
                onHideCustomView();
            }

            FrameLayout rootView = findViewById(android.R.id.content);
            if (rootView == null) {
                callback.onCustomViewHidden();
                return;
            }

            fullScreenVideoView = view;
            fullScreenVideoCallback = callback;
            view.setBackgroundColor(Color.BLACK);
            rootView.addView(
                view,
                new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            );
            rootView.setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
        }

        @Override
        public void onHideCustomView() {
            hideFullScreenVideoView();
        }
    }

    private void hideFullScreenVideoView() {
        FrameLayout rootView = findViewById(android.R.id.content);
        if (fullScreenVideoView != null && rootView != null) {
            rootView.removeView(fullScreenVideoView);
        }

        if (rootView != null) {
            rootView.setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }

        WebChromeClient.CustomViewCallback callback = fullScreenVideoCallback;
        fullScreenVideoView = null;
        fullScreenVideoCallback = null;
        if (callback != null) {
            callback.onCustomViewHidden();
        }
    }
}
