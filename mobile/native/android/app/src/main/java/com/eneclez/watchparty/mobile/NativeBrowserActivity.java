package com.eneclez.watchparty.mobile;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

public class NativeBrowserActivity extends Activity {
    private WebView webView;
    private ProgressBar progress;

    private final String[][] sites = new String[][] {
        {"YouTube", "https://m.youtube.com/"},
        {"Bilibili", "https://m.bilibili.com/"},
        {"Dailymotion", "https://www.dailymotion.com/"},
        {"Facebook", "https://m.facebook.com/watch/"}
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        String startUrl = getIntent().getStringExtra("url");
        if (startUrl == null || startUrl.trim().isEmpty()) {
            startUrl = sites[0][1];
        }

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(14, 14, 14, 14);
        root.setBackgroundColor(Color.rgb(11, 13, 18));

        GridLayout siteTabs = new GridLayout(this);
        siteTabs.setColumnCount(4);
        siteTabs.setUseDefaultMargins(true);
        root.addView(siteTabs, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        for (String[] site : sites) {
            Button button = makeButton(site[0], true);
            button.setOnClickListener(v -> load(site[1]));
            siteTabs.addView(button, new ViewGroupLayoutParams());
        }

        LinearLayout nav = new LinearLayout(this);
        nav.setGravity(Gravity.CENTER);
        nav.setOrientation(LinearLayout.HORIZONTAL);
        nav.setPadding(0, 8, 0, 8);
        root.addView(nav, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        Button back = makeButton("<", false);
        Button forward = makeButton(">", false);
        Button reload = makeButton("R", false);
        nav.addView(back, new LinearLayout.LayoutParams(0, 44, 1));
        nav.addView(forward, new LinearLayout.LayoutParams(0, 44, 1));
        nav.addView(reload, new LinearLayout.LayoutParams(0, 44, 1));

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setPadding(0, 0, 0, 8);
        root.addView(actions, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        Button queue = makeButton("Queue", true);
        actions.addView(queue, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            46
        ));

        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        root.addView(progress, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            6
        ));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        root.addView(webView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1
        ));

        setContentView(root);
        configureWebView();

        back.setOnClickListener(v -> {
            if (webView.canGoBack()) webView.goBack();
        });
        forward.setOnClickListener(v -> {
            if (webView.canGoForward()) webView.goForward();
        });
        reload.setOnClickListener(v -> webView.reload());
        queue.setOnClickListener(v -> finishWith("queue"));

        load(startUrl);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setSupportMultipleWindows(false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                view.loadUrl(url);
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progress.setProgress(newProgress);
                progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }
        });
    }

    private void load(String rawUrl) {
        String url = normalizeUrl(rawUrl);
        webView.loadUrl(url);
    }

    private String normalizeUrl(String rawUrl) {
        String value = rawUrl == null ? "" : rawUrl.trim();
        if (value.startsWith("http://") || value.startsWith("https://")) return value;
        if (value.contains(".") && !value.contains(" ")) return "https://" + value;
        return "https://m.youtube.com/results?search_query=" + Uri.encode(value);
    }

    private Button makeButton(String text, boolean primary) {
        Button button = new Button(this);
        button.setAllCaps(false);
        button.setText(text);
        button.setTextColor(primary ? Color.rgb(7, 17, 15) : Color.WHITE);
        button.setTextSize(13);
        button.setBackgroundColor(primary ? Color.rgb(106, 207, 160) : Color.rgb(29, 35, 48));
        return button;
    }

    private void finishWith(String action) {
        Intent result = new Intent();
        result.putExtra("action", action);
        result.putExtra("url", webView.getUrl());
        result.putExtra("title", webView.getTitle());
        setResult(Activity.RESULT_OK, result);
        finish();
    }

    private static class ViewGroupLayoutParams extends ViewGroup.MarginLayoutParams {
        ViewGroupLayoutParams() {
            super(ViewGroup.LayoutParams.WRAP_CONTENT, 44);
            setMargins(4, 4, 4, 4);
        }
    }
}
