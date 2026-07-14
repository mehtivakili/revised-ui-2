package com.persiasystem.hamyardoorbin;

import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.FrameLayout;
import android.widget.ImageView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final long FULL_SCREEN_SPLASH_DURATION_MS = 2200L;
    private ImageView fullScreenSplash;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerWebViewBackNavigation();
        showFullScreenSplash();
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
        hideFullScreenSplash();
        super.onDestroy();
    }
}
