package com.pocketdatingcoach.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.widget.ProgressBar;

import androidx.coordinatorlayout.widget.CoordinatorLayout;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * MainActivity extends Capacitor's BridgeActivity to add:
 * - Branded splash screen displayed until the bundled SPA finishes loading (max 5s)
 * - A brief loading indicator while the local bundle boots
 * - Back button navigation through WebView history
 *
 * The app now loads the locally-bundled SPA from assets (no `server.url`) and
 * calls the API remotely, so the previous remote-loading machinery — domain
 * whitelisting, offline overlay, connectivity monitoring, retry, and
 * process-death URL restore — is gone. External links and in-app client routing
 * are handled by Capacitor's default WebView client.
 */
public class MainActivity extends BridgeActivity {

    // Local bundle loads near-instantly; keep a short safety cap on the splash.
    private static final long SPLASH_MAX_DURATION_MS = 5_000;

    private boolean isContentLoaded = false;
    private ProgressBar loadingIndicator;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install the AndroidX (branded) splash screen before super.onCreate()
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);

        // Keep the splash visible until the bundled SPA finishes its first paint.
        splashScreen.setKeepOnScreenCondition(() -> !isContentLoaded);

        // Detect when the page finishes loading to dismiss the splash.
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                onContentLoaded();
            }
        });

        super.onCreate(savedInstanceState);

        // Thin indeterminate progress bar at the top while the bundle boots.
        addLoadingIndicator();

        // Safety cap so the splash never sticks if onPageLoaded doesn't fire.
        handler.postDelayed(() -> {
            isContentLoaded = true;
            dismissLoadingIndicator();
        }, SPLASH_MAX_DURATION_MS);
    }

    // ==================== Loading Indicator ====================

    /**
     * Adds a horizontal indeterminate ProgressBar at the top of the
     * CoordinatorLayout that Capacitor uses as its root view.
     */
    private void addLoadingIndicator() {
        ViewGroup rootView = findViewById(android.R.id.content);
        if (rootView != null && rootView.getChildCount() > 0) {
            View contentView = rootView.getChildAt(0);
            if (contentView instanceof ViewGroup) {
                loadingIndicator = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
                loadingIndicator.setIndeterminate(true);

                CoordinatorLayout.LayoutParams params = new CoordinatorLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        (int) (4 * getResources().getDisplayMetrics().density) // 4dp height
                );
                params.gravity = Gravity.TOP;
                loadingIndicator.setLayoutParams(params);

                ((ViewGroup) contentView).addView(loadingIndicator);
            }
        }
    }

    /**
     * Called when the bundled SPA has finished loading via the WebViewListener.
     */
    private void onContentLoaded() {
        handler.post(() -> {
            isContentLoaded = true;
            dismissLoadingIndicator();
        });
    }

    /**
     * Hides the loading progress bar.
     */
    private void dismissLoadingIndicator() {
        if (loadingIndicator != null) {
            loadingIndicator.setVisibility(View.GONE);
        }
    }

    // ==================== Back Navigation ====================

    /**
     * Override back button to navigate WebView history before exiting.
     */
    @Override
    public void onBackPressed() {
        WebView webView = getBridge().getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ==================== Lifecycle ====================

    @Override
    public void onDestroy() {
        // Remove any pending callbacks to prevent leaks
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }
}
