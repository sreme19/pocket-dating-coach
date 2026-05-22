package com.pocketdatingcoach.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.SslErrorHandler;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.coordinatorlayout.widget.CoordinatorLayout;
import androidx.core.splashscreen.SplashScreen;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;

/**
 * MainActivity extends Capacitor's BridgeActivity to add:
 * - Branded splash screen displayed during WebView load (max 10 seconds)
 * - Loading indicator visible while remote content loads
 * - Back button navigation through WebView history
 * - Instance state save/restore for process death recovery
 * - Domain restriction (external URLs open in system browser)
 * - SSL error handling (block navigation, show warning)
 * - Offline detection with full-screen offline state and auto-retry
 */
public class MainActivity extends BridgeActivity {

    private static final String KEY_WEBVIEW_URL = "webview_current_url";
    private static final String SERVER_URL = "https://verified-vibe.vercel.app";
    private static final long SPLASH_MAX_DURATION_MS = 10_000; // 10 seconds max
    private static final long AUTO_RETRY_DELAY_MS = 3_000; // 3 seconds after connectivity restored
    private static final long RETRY_INTERVAL_MS = 5_000; // 5 seconds between retry attempts
    private static final int MAX_RETRY_ATTEMPTS = 3;

    private String restoredUrl = null;
    private boolean isContentLoaded = false;
    private boolean hasLoadedContentOnce = false;
    private ProgressBar loadingIndicator;
    private LinearLayout offlineOverlay;
    private LinearLayout inlineErrorBanner;
    private final Handler handler = new Handler(Looper.getMainLooper());

    // Offline/retry state
    private ConnectivityManager connectivityManager;
    private ConnectivityManager.NetworkCallback networkCallback;
    private int retryAttempts = 0;
    private boolean isOfflineStateVisible = false;
    private boolean isRetrying = false;
    private Runnable retryRunnable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install the AndroidX splash screen before super.onCreate()
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);

        // Keep the splash screen visible until content loads or timeout expires
        splashScreen.setKeepOnScreenCondition(() -> !isContentLoaded);

        // Register a WebViewListener to detect when the page finishes loading.
        bridgeBuilder.addWebViewListener(new WebViewListener() {
            @Override
            public void onPageLoaded(WebView webView) {
                onContentLoaded();
            }
        });

        super.onCreate(savedInstanceState);

        // Add a horizontal indeterminate progress bar at the top of the content view
        addLoadingIndicator();

        // Add the offline overlay (hidden by default)
        addOfflineOverlay();

        // Add the inline error banner (hidden by default)
        addInlineErrorBanner();

        // Set a maximum duration for the splash screen (10 seconds).
        handler.postDelayed(() -> {
            isContentLoaded = true;
            dismissLoadingIndicator();
        }, SPLASH_MAX_DURATION_MS);

        // Restore URL from saved instance state (process death recovery)
        if (savedInstanceState != null) {
            restoredUrl = savedInstanceState.getString(KEY_WEBVIEW_URL);
        }

        // Initialize network connectivity monitoring
        setupNetworkMonitoring();

        // Check initial connectivity — if offline on launch, show offline state
        if (!isNetworkAvailable()) {
            showOfflineState();
        }
    }

    @Override
    public void onPostCreate(Bundle savedInstanceState) {
        super.onPostCreate(savedInstanceState);

        // Configure the WebView client after Capacitor has initialized the bridge
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setWebViewClient(new SecureWebViewClient());

            // If we have a restored URL from process death, navigate to it
            if (restoredUrl != null && !restoredUrl.isEmpty()) {
                webView.loadUrl(restoredUrl);
            }
        }
    }

    // ==================== Loading Indicator ====================

    /**
     * Programmatically adds a horizontal indeterminate ProgressBar at the top of the
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
     * Called when the remote content has finished loading via the WebViewListener.
     */
    private void onContentLoaded() {
        handler.post(() -> {
            isContentLoaded = true;
            hasLoadedContentOnce = true;
            retryAttempts = 0;
            isRetrying = false;
            dismissLoadingIndicator();
            hideOfflineState();
            hideInlineError();
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

    // ==================== Offline Overlay (Full-Screen) ====================

    /**
     * Creates and adds the full-screen offline overlay to the root view.
     * This overlay is shown when the app launches offline or after max retries fail.
     */
    private void addOfflineOverlay() {
        ViewGroup rootView = findViewById(android.R.id.content);
        if (rootView == null || rootView.getChildCount() == 0) return;

        View contentView = rootView.getChildAt(0);
        if (!(contentView instanceof ViewGroup)) return;

        offlineOverlay = new LinearLayout(this);
        offlineOverlay.setOrientation(LinearLayout.VERTICAL);
        offlineOverlay.setGravity(Gravity.CENTER);
        offlineOverlay.setBackgroundColor(Color.WHITE);
        offlineOverlay.setVisibility(View.GONE);
        offlineOverlay.setClickable(true); // Consume touch events so WebView isn't interacted with

        CoordinatorLayout.LayoutParams overlayParams = new CoordinatorLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        );
        offlineOverlay.setLayoutParams(overlayParams);

        // Offline icon
        ImageView offlineIcon = new ImageView(this);
        offlineIcon.setImageResource(R.drawable.ic_cloud_off);
        int iconSize = (int) (96 * getResources().getDisplayMetrics().density);
        LinearLayout.LayoutParams iconParams = new LinearLayout.LayoutParams(iconSize, iconSize);
        iconParams.gravity = Gravity.CENTER_HORIZONTAL;
        offlineIcon.setLayoutParams(iconParams);
        offlineOverlay.addView(offlineIcon);

        // Title text
        TextView titleText = new TextView(this);
        titleText.setText(R.string.offline_title);
        titleText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        titleText.setTypeface(null, Typeface.BOLD);
        titleText.setTextColor(Color.parseColor("#212121"));
        titleText.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        titleParams.gravity = Gravity.CENTER_HORIZONTAL;
        titleParams.topMargin = (int) (24 * getResources().getDisplayMetrics().density);
        titleText.setLayoutParams(titleParams);
        offlineOverlay.addView(titleText);

        // Message text
        TextView messageText = new TextView(this);
        messageText.setText(R.string.offline_message);
        messageText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        messageText.setTextColor(Color.parseColor("#757575"));
        messageText.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        messageParams.gravity = Gravity.CENTER_HORIZONTAL;
        messageParams.topMargin = (int) (12 * getResources().getDisplayMetrics().density);
        messageText.setLayoutParams(messageParams);
        offlineOverlay.addView(messageText);

        // Retry button
        Button retryButton = new Button(this);
        retryButton.setText(R.string.offline_retry);
        retryButton.setTextColor(Color.WHITE);
        retryButton.setBackgroundColor(Color.parseColor("#6200EE"));
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        buttonParams.gravity = Gravity.CENTER_HORIZONTAL;
        buttonParams.topMargin = (int) (32 * getResources().getDisplayMetrics().density);
        int horizontalPadding = (int) (32 * getResources().getDisplayMetrics().density);
        int verticalPadding = (int) (12 * getResources().getDisplayMetrics().density);
        retryButton.setPadding(horizontalPadding, verticalPadding, horizontalPadding, verticalPadding);
        retryButton.setLayoutParams(buttonParams);
        retryButton.setOnClickListener(v -> onManualRetry());
        offlineOverlay.addView(retryButton);

        ((ViewGroup) contentView).addView(offlineOverlay);
    }

    /**
     * Shows the full-screen offline overlay.
     */
    private void showOfflineState() {
        if (offlineOverlay != null) {
            offlineOverlay.setVisibility(View.VISIBLE);
            isOfflineStateVisible = true;
        }
    }

    /**
     * Hides the full-screen offline overlay.
     */
    private void hideOfflineState() {
        if (offlineOverlay != null) {
            offlineOverlay.setVisibility(View.GONE);
            isOfflineStateVisible = false;
        }
    }

    // ==================== Inline Error Banner ====================

    /**
     * Creates and adds an inline error banner at the bottom of the screen.
     * Shown during active use when a network request fails (WebView content remains visible).
     */
    private void addInlineErrorBanner() {
        ViewGroup rootView = findViewById(android.R.id.content);
        if (rootView == null || rootView.getChildCount() == 0) return;

        View contentView = rootView.getChildAt(0);
        if (!(contentView instanceof ViewGroup)) return;

        inlineErrorBanner = new LinearLayout(this);
        inlineErrorBanner.setOrientation(LinearLayout.HORIZONTAL);
        inlineErrorBanner.setGravity(Gravity.CENTER_VERTICAL);
        inlineErrorBanner.setBackgroundColor(Color.parseColor("#323232"));
        inlineErrorBanner.setVisibility(View.GONE);

        CoordinatorLayout.LayoutParams bannerParams = new CoordinatorLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
        );
        bannerParams.gravity = Gravity.BOTTOM;
        inlineErrorBanner.setLayoutParams(bannerParams);

        int padding = (int) (16 * getResources().getDisplayMetrics().density);
        inlineErrorBanner.setPadding(padding, padding, padding, padding);

        // Error message
        TextView errorMessage = new TextView(this);
        errorMessage.setText(R.string.offline_inline_message);
        errorMessage.setTextColor(Color.WHITE);
        errorMessage.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        LinearLayout.LayoutParams textParams = new LinearLayout.LayoutParams(
                0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f
        );
        errorMessage.setLayoutParams(textParams);
        inlineErrorBanner.addView(errorMessage);

        // Retry button
        Button retryBtn = new Button(this);
        retryBtn.setText(R.string.offline_retry);
        retryBtn.setTextColor(Color.parseColor("#BB86FC"));
        retryBtn.setBackgroundColor(Color.TRANSPARENT);
        retryBtn.setOnClickListener(v -> onManualRetry());
        inlineErrorBanner.addView(retryBtn);

        inlineErrorBanner.setOnClickListener(v -> onManualRetry());

        ((ViewGroup) contentView).addView(inlineErrorBanner);
    }

    /**
     * Shows the inline error banner (used during active use when content is already loaded).
     */
    private void showInlineError() {
        if (inlineErrorBanner != null && hasLoadedContentOnce) {
            inlineErrorBanner.setVisibility(View.VISIBLE);
        }
    }

    /**
     * Hides the inline error banner.
     */
    private void hideInlineError() {
        if (inlineErrorBanner != null) {
            inlineErrorBanner.setVisibility(View.GONE);
        }
    }

    // ==================== Network Monitoring ====================

    /**
     * Sets up ConnectivityManager network callbacks to detect connectivity changes.
     * When connectivity is restored, auto-retries loading within 3 seconds.
     */
    private void setupNetworkMonitoring() {
        connectivityManager = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
        if (connectivityManager == null) return;

        NetworkRequest networkRequest = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();

        networkCallback = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                // Network connectivity restored — auto-retry within 3 seconds
                handler.postDelayed(() -> {
                    if (isOfflineStateVisible || (inlineErrorBanner != null
                            && inlineErrorBanner.getVisibility() == View.VISIBLE)) {
                        retryAttempts = 0;
                        attemptRetry();
                    }
                }, AUTO_RETRY_DELAY_MS);
            }

            @Override
            public void onLost(@NonNull Network network) {
                // Network lost — if no other network is available, show appropriate state
                handler.post(() -> {
                    if (!isNetworkAvailable()) {
                        if (hasLoadedContentOnce) {
                            // Content was previously loaded — show inline error, keep content visible
                            showInlineError();
                        } else {
                            // Never loaded content — show full-screen offline state
                            showOfflineState();
                        }
                    }
                });
            }
        };

        connectivityManager.registerNetworkCallback(networkRequest, networkCallback);
    }

    /**
     * Checks if network connectivity is currently available.
     */
    private boolean isNetworkAvailable() {
        if (connectivityManager == null) return false;

        Network activeNetwork = connectivityManager.getActiveNetwork();
        if (activeNetwork == null) return false;

        NetworkCapabilities capabilities = connectivityManager.getNetworkCapabilities(activeNetwork);
        return capabilities != null &&
                (capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) ||
                 capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) ||
                 capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET));
    }

    // ==================== Retry Logic ====================

    /**
     * Handles manual retry button press.
     * Resets retry counter and attempts to load.
     */
    private void onManualRetry() {
        retryAttempts = 0;
        isRetrying = false;
        cancelPendingRetries();
        attemptRetry();
    }

    /**
     * Attempts to reload the WebView content.
     * If max retries are exceeded, shows the offline state.
     */
    private void attemptRetry() {
        if (isRetrying) return;

        if (retryAttempts >= MAX_RETRY_ATTEMPTS) {
            // Max retries exceeded — show offline state with manual retry button
            isRetrying = false;
            if (hasLoadedContentOnce) {
                showInlineError();
            } else {
                showOfflineState();
            }
            return;
        }

        isRetrying = true;
        retryAttempts++;

        WebView webView = getBridge() != null ? getBridge().getWebView() : null;
        if (webView != null) {
            handler.post(() -> {
                // Show loading indicator during retry
                if (loadingIndicator != null) {
                    loadingIndicator.setVisibility(View.VISIBLE);
                }
                webView.loadUrl(SERVER_URL);
            });
        }

        // Schedule next retry attempt after interval if this one fails
        retryRunnable = () -> {
            isRetrying = false;
            // If still in offline/error state, try again
            if (isOfflineStateVisible || (inlineErrorBanner != null
                    && inlineErrorBanner.getVisibility() == View.VISIBLE)) {
                attemptRetry();
            }
        };
        handler.postDelayed(retryRunnable, RETRY_INTERVAL_MS);
    }

    /**
     * Cancels any pending retry callbacks.
     */
    private void cancelPendingRetries() {
        if (retryRunnable != null) {
            handler.removeCallbacks(retryRunnable);
            retryRunnable = null;
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

    /**
     * Save the current WebView URL to instance state for process death recovery.
     */
    @Override
    public void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        WebView webView = getBridge().getWebView();
        if (webView != null && webView.getUrl() != null) {
            outState.putString(KEY_WEBVIEW_URL, webView.getUrl());
        }
    }

    @Override
    public void onDestroy() {
        // Remove any pending callbacks to prevent leaks
        handler.removeCallbacksAndMessages(null);

        // Unregister network callback to prevent leaks
        if (connectivityManager != null && networkCallback != null) {
            try {
                connectivityManager.unregisterNetworkCallback(networkCallback);
            } catch (IllegalArgumentException e) {
                // Callback was already unregistered — ignore
            }
        }

        super.onDestroy();
    }

    // ==================== WebView Client ====================

    /**
     * Custom WebViewClient that enforces:
     * - Domain restriction: only server.url origin is allowed in-app
     * - External URLs open in system browser
     * - SSL errors block navigation entirely (no bypass)
     * - Fallback to server.url if a restored URL fails to load
     * - Offline error handling with retry support
     */
    private class SecureWebViewClient extends WebViewClient {

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isAllowedOrigin(uri)) {
                return false;
            } else {
                Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            }
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            // Block navigation on SSL errors — never bypass
            handler.cancel();
            Toast.makeText(
                    MainActivity.this,
                    "Security warning: Connection is not secure. Navigation blocked.",
                    Toast.LENGTH_LONG
            ).show();
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            super.onReceivedError(view, request, error);

            if (!request.isForMainFrame()) return;

            // If we were trying a restored URL, fall back to server URL
            if (restoredUrl != null) {
                restoredUrl = null;
                view.loadUrl(SERVER_URL);
                return;
            }

            // Handle network errors gracefully
            handler.post(() -> {
                if (hasLoadedContentOnce) {
                    // Content was previously loaded — show inline error, keep content visible
                    showInlineError();
                } else {
                    // Never loaded content — show full-screen offline state
                    showOfflineState();
                }
                dismissLoadingIndicator();
            });
        }

        /**
         * Check if a URI matches the configured server.url origin.
         */
        private boolean isAllowedOrigin(Uri uri) {
            if (uri == null) return false;
            String scheme = uri.getScheme();
            String host = uri.getHost();
            if (scheme == null || host == null) return false;

            Uri serverUri = Uri.parse(SERVER_URL);
            String serverScheme = serverUri.getScheme();
            String serverHost = serverUri.getHost();

            return scheme.equalsIgnoreCase(serverScheme) && host.equalsIgnoreCase(serverHost);
        }
    }
}
