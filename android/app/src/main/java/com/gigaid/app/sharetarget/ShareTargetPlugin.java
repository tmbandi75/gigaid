package com.gigaid.app.sharetarget;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Opens the Android share sheet and reports back the chosen app's
 * package name via {@code Intent.EXTRA_CHOSEN_COMPONENT}.
 *
 * Semantics: {@code shared: true} means the user picked a destination
 * in the chooser (Android's strongest available signal). It does NOT
 * confirm the destination app actually sent / posted the content —
 * Android does not expose an in-app delivery callback. The analytics
 * pipeline treats chooser-confirmed as a completed share.
 *
 * Android does not guarantee ordering between the chosen-component
 * broadcast and the chooser activity returning, so this plugin waits
 * for whichever signal arrives second:
 *   - if the broadcast arrives first, it stores the package and the
 *     activity callback resolves immediately with it;
 *   - if the activity callback fires first, it posts a short grace
 *     window before resolving so a late broadcast can still attach the
 *     package; the broadcast resolves the call directly if it arrives
 *     during that window.
 * Either way the call is resolved exactly once.
 */
@CapacitorPlugin(name = "ShareTarget")
public class ShareTargetPlugin extends Plugin {

    private static final String CHOSEN_ACTION =
        "com.gigaid.app.sharetarget.SHARE_TARGET_CHOSEN";
    private static final long LATE_BROADCAST_GRACE_MS = 400L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private BroadcastReceiver chosenReceiver;

    private String pendingCallbackId;
    private String pendingPackage;
    private boolean activityReturned;
    private Runnable pendingResolve;
    private boolean isPresenting = false;

    @Override
    public void load() {
        chosenReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                ComponentName chosen;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    chosen = intent.getParcelableExtra(
                        Intent.EXTRA_CHOSEN_COMPONENT, ComponentName.class);
                } else {
                    chosen = getParcelableExtraLegacy(
                        intent, Intent.EXTRA_CHOSEN_COMPONENT);
                }
                onChosen(chosen);
            }
        };
        ContextCompat.registerReceiver(
            getContext(),
            chosenReceiver,
            new IntentFilter(CHOSEN_ACTION),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @SuppressWarnings("deprecation")
    private static ComponentName getParcelableExtraLegacy(Intent intent, String key) {
        return intent.getParcelableExtra(key);
    }

    @Override
    protected void handleOnDestroy() {
        if (chosenReceiver != null) {
            try {
                getContext().unregisterReceiver(chosenReceiver);
            } catch (IllegalArgumentException ignored) { }
            chosenReceiver = null;
        }
    }

    @PluginMethod
    public void share(PluginCall call) {
        if (isPresenting) {
            call.reject("Share already in progress");
            return;
        }

        String title = call.getString("title");
        String text = call.getString("text");
        String url = call.getString("url");
        String dialogTitle = call.getString("dialogTitle", "Share");

        if ((text == null || text.isEmpty()) && (url == null || url.isEmpty())) {
            call.reject("Must provide text or url");
            return;
        }

        Intent send = new Intent(Intent.ACTION_SEND);
        send.setType("text/plain");
        StringBuilder body = new StringBuilder();
        if (text != null && !text.isEmpty()) body.append(text);
        if (url != null && !url.isEmpty()) {
            if (body.length() > 0) body.append(' ');
            body.append(url);
        }
        send.putExtra(Intent.EXTRA_TEXT, body.toString());
        if (title != null && !title.isEmpty()) {
            send.putExtra(Intent.EXTRA_SUBJECT, title);
        }

        Context context = getContext();
        Intent broadcast =
            new Intent(CHOSEN_ACTION).setPackage(context.getPackageName());

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            piFlags |= PendingIntent.FLAG_MUTABLE;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            piFlags |= PendingIntent.FLAG_ALLOW_UNSAFE_IMPLICIT_INTENT;
        }
        PendingIntent pi =
            PendingIntent.getBroadcast(context, 0, broadcast, piFlags);

        Intent chooser;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP_MR1) {
            chooser = Intent.createChooser(send, dialogTitle, pi.getIntentSender());
        } else {
            chooser = Intent.createChooser(send, dialogTitle);
        }
        chooser.addCategory(Intent.CATEGORY_DEFAULT);

        pendingCallbackId = call.getCallbackId();
        pendingPackage = null;
        activityReturned = false;
        pendingResolve = null;
        isPresenting = true;
        startActivityForResult(call, chooser, "shareResult");
    }

    @ActivityCallback
    private void shareResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        activityReturned = true;
        // If the broadcast already gave us a package, resolve now.
        if (pendingPackage != null) {
            resolveOnce(call, true, pendingPackage);
            return;
        }
        // Otherwise wait briefly for a late broadcast. If none arrives,
        // resolve based on the activity's result code: RESULT_OK means
        // the user shared (we just don't know to whom — the upstream
        // analytics will bucket it as "unknown"), RESULT_CANCELED means
        // the chooser was dismissed.
        final boolean okFromActivity = result.getResultCode() == Activity.RESULT_OK;
        pendingResolve = () -> {
            pendingResolve = null;
            // Re-check in case the broadcast arrived during the delay.
            String pkg = pendingPackage;
            boolean shared = pkg != null || okFromActivity;
            resolveOnce(call, shared, pkg);
        };
        mainHandler.postDelayed(pendingResolve, LATE_BROADCAST_GRACE_MS);
    }

    private void onChosen(ComponentName chosen) {
        if (chosen == null) return;
        pendingPackage = chosen.getPackageName();
        // If the activity already returned and is currently waiting in
        // the grace window, cancel it and resolve immediately.
        if (activityReturned && pendingResolve != null && pendingCallbackId != null) {
            mainHandler.removeCallbacks(pendingResolve);
            pendingResolve = null;
            PluginCall call = bridge.getSavedCall(pendingCallbackId);
            if (call != null) {
                resolveOnce(call, true, pendingPackage);
            }
        }
        // Otherwise the activityResult path will pick it up when it fires.
    }

    private void resolveOnce(PluginCall call, boolean shared, String pkg) {
        JSObject ret = new JSObject();
        ret.put("shared", shared);
        if (pkg != null) ret.put("activityType", pkg);
        try {
            call.resolve(ret);
        } finally {
            if (pendingCallbackId != null) {
                bridge.releaseCall(call);
            }
            pendingCallbackId = null;
            pendingPackage = null;
            activityReturned = false;
            pendingResolve = null;
            isPresenting = false;
        }
    }
}
