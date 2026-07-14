package com.persiasystem.hamyardoorbin;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long FULL_SCREEN_SPLASH_DURATION_MS = 2200L;
    private static final long AUTO_RETRY_DURATION_MS = 30000L;
    private static final long RETRY_INTERVAL_MS = 3000L;
    private static final String PRODUCTION_HOST = "hamyardoorbin.ir";
    private static final String PRODUCTION_URL = "https://hamyardoorbin.ir";

    private final Handler connectionHandler = new Handler(Looper.getMainLooper());
    private ImageView fullScreenSplash;
    private FrameLayout connectionOverlay;
    private TextView connectionDots;
    private TextView connectionStatus;
    private Button retryButton;
    private long retryDeadline;
    private int dotPhase;
    private boolean retryCycleActive;
    private boolean mainFrameFailed;

    private final Runnable dotsRunnable = new Runnable() {
        @Override
        public void run() {
            if (connectionDots == null || !retryCycleActive) return;
            dotPhase = (dotPhase % 3) + 1;
            connectionDots.setText(dotPhase == 1 ? "•" : dotPhase == 2 ? "•  •" : "•  •  •");
            connectionHandler.postDelayed(this, 420L);
        }
    };

    private final Runnable retryRunnable = new Runnable() {
        @Override
        public void run() {
            if (!retryCycleActive || connectionOverlay == null) return;
            if (SystemClock.elapsedRealtime() >= retryDeadline) {
                stopAutomaticRetry();
                return;
            }
            retryWebView();
            connectionHandler.postDelayed(this, RETRY_INTERVAL_MS);
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        installConnectionAwareWebViewClient();
        registerWebViewBackNavigation();
        showFullScreenSplash();
    }

    private void installConnectionAwareWebViewClient() {
        getBridge().setWebViewClient(new BridgeWebViewClient(getBridge()) {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                mainFrameFailed = false;
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    mainFrameFailed = true;
                    showConnectionOverlay();
                }
                super.onReceivedError(view, request, error);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse response) {
                if (request.isForMainFrame() && response.getStatusCode() >= 500) {
                    mainFrameFailed = true;
                    showConnectionOverlay();
                }
                super.onReceivedHttpError(view, request, response);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (!mainFrameFailed && isProductionPage(url)) {
                    hideConnectionOverlay(true);
                }
            }
        });
    }

    private boolean isProductionPage(String url) {
        if (url == null) return false;
        try {
            return PRODUCTION_HOST.equalsIgnoreCase(android.net.Uri.parse(url).getHost());
        } catch (Exception ignored) {
            return false;
        }
    }

    private void registerWebViewBackNavigation() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (getBridge() != null
                    && getBridge().getWebView() != null
                    && getBridge().getWebView().canGoBack()) {
                    getBridge().getWebView().goBack();
                    return;
                }

                setEnabled(false);
                getOnBackPressedDispatcher().onBackPressed();
            }
        });
    }

    private void showFullScreenSplash() {
        Window window = getWindow();
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(false);
        } else {
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            );
        }

        FrameLayout content = findViewById(android.R.id.content);
        fullScreenSplash = new ImageView(this);
        fullScreenSplash.setImageResource(R.drawable.splash_fullscreen);
        fullScreenSplash.setScaleType(ImageView.ScaleType.FIT_CENTER);
        fullScreenSplash.setBackgroundColor(getColor(R.color.splash_background));
        fullScreenSplash.setContentDescription(null);

        content.addView(
            fullScreenSplash,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
        fullScreenSplash.bringToFront();

        new Handler(Looper.getMainLooper()).postDelayed(
            this::hideFullScreenSplash,
            FULL_SCREEN_SPLASH_DURATION_MS
        );
    }

    private void showConnectionOverlay() {
        runOnUiThread(() -> {
            if (connectionOverlay == null) createConnectionOverlay();
            connectionOverlay.setVisibility(View.VISIBLE);
            connectionOverlay.bringToFront();
            if (fullScreenSplash != null) fullScreenSplash.bringToFront();
            if (!retryCycleActive) beginRetryCycle();
        });
    }

    private void createConnectionOverlay() {
        FrameLayout content = findViewById(android.R.id.content);
        connectionOverlay = new FrameLayout(this);
        connectionOverlay.setBackgroundColor(getColor(R.color.splash_background));

        ImageView artwork = new ImageView(this);
        artwork.setImageResource(R.drawable.splash_fullscreen);
        artwork.setScaleType(ImageView.ScaleType.FIT_CENTER);
        artwork.setContentDescription(null);
        connectionOverlay.addView(
            artwork,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );

        LinearLayout connectionPanel = new LinearLayout(this);
        connectionPanel.setOrientation(LinearLayout.VERTICAL);
        connectionPanel.setGravity(Gravity.CENTER);
        connectionPanel.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);

        connectionDots = new TextView(this);
        connectionDots.setText("•");
        connectionDots.setTextColor(Color.WHITE);
        connectionDots.setTextSize(20f);
        connectionDots.setGravity(Gravity.CENTER);
        connectionPanel.addView(connectionDots);

        connectionStatus = new TextView(this);
        connectionStatus.setText("در حال اتصال");
        connectionStatus.setTextColor(Color.WHITE);
        connectionStatus.setTextSize(15f);
        connectionStatus.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams statusParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        statusParams.topMargin = dp(6);
        connectionPanel.addView(connectionStatus, statusParams);

        retryButton = new Button(this);
        retryButton.setText("تلاش مجدد");
        retryButton.setTextColor(getColor(R.color.splash_background));
        retryButton.setTextSize(14f);
        retryButton.setAllCaps(false);
        retryButton.setVisibility(View.GONE);
        retryButton.setPadding(dp(28), dp(8), dp(28), dp(8));
        GradientDrawable retryBackground = new GradientDrawable();
        retryBackground.setColor(Color.rgb(54, 231, 239));
        retryBackground.setCornerRadius(dp(12));
        retryButton.setBackground(retryBackground);
        retryButton.setOnClickListener(view -> {
            beginRetryCycle();
            retryWebView();
        });
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT
        );
        buttonParams.topMargin = dp(14);
        connectionPanel.addView(retryButton, buttonParams);

        FrameLayout.LayoutParams panelParams = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            ViewGroup.LayoutParams.WRAP_CONTENT,
            Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
        );
        panelParams.bottomMargin = dp(48);
        connectionOverlay.addView(connectionPanel, panelParams);
        content.addView(
            connectionOverlay,
            new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        );
    }

    private void beginRetryCycle() {
        retryCycleActive = true;
        retryDeadline = SystemClock.elapsedRealtime() + AUTO_RETRY_DURATION_MS;
        dotPhase = 0;
        connectionStatus.setText("در حال اتصال");
        retryButton.setVisibility(View.GONE);
        connectionHandler.removeCallbacks(dotsRunnable);
        connectionHandler.removeCallbacks(retryRunnable);
        connectionHandler.post(dotsRunnable);
        connectionHandler.postDelayed(retryRunnable, 1500L);
    }

    private void stopAutomaticRetry() {
        retryCycleActive = false;
        connectionHandler.removeCallbacks(dotsRunnable);
        connectionHandler.removeCallbacks(retryRunnable);
        if (connectionDots != null) connectionDots.setText("•  •  •");
        if (retryButton != null) retryButton.setVisibility(View.VISIBLE);
    }

    private void retryWebView() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView == null) return;
        webView.stopLoading();
        webView.loadUrl(PRODUCTION_URL);
    }

    private void hideConnectionOverlay(boolean clearFailedHistory) {
        runOnUiThread(() -> {
            if (connectionOverlay == null) return;
            retryCycleActive = false;
            connectionHandler.removeCallbacks(dotsRunnable);
            connectionHandler.removeCallbacks(retryRunnable);
            ViewGroup parent = (ViewGroup) connectionOverlay.getParent();
            if (parent != null) parent.removeView(connectionOverlay);
            connectionOverlay = null;
            connectionDots = null;
            connectionStatus = null;
            retryButton = null;
            if (clearFailedHistory && getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().clearHistory();
            }
        });
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private void hideFullScreenSplash() {
        if (fullScreenSplash == null) return;
        ViewGroup parent = (ViewGroup) fullScreenSplash.getParent();
        if (parent != null) parent.removeView(fullScreenSplash);
        fullScreenSplash = null;
        restoreAppWindowInsets();
    }

    private void restoreAppWindowInsets() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            window.setDecorFitsSystemWindows(true);
        } else {
            window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        }
        window.setStatusBarColor(getColor(R.color.splash_background));
        window.setNavigationBarColor(getColor(R.color.splash_background));
    }

    @Override
    public void onDestroy() {
        connectionHandler.removeCallbacksAndMessages(null);
        hideConnectionOverlay(false);
        hideFullScreenSplash();
        super.onDestroy();
    }
}
