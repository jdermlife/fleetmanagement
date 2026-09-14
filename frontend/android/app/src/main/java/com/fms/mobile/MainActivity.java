package com.quantech.filscore;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;

import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity
        implements ModifiedMainActivityForSocialLoginPlugin {

    @Override
    public void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {

        super.onActivityResult(
                requestCode,
                resultCode,
                data);

        // =====================================================
        // GOOGLE LOGIN
        //
        // EXISTING CODE - DO NOT CHANGE
        // =====================================================

        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {

            PluginHandle pluginHandle =
                    getBridge().getPlugin("SocialLogin");

            if (pluginHandle == null) {
                Log.i(
                        "Google Activity Result",
                        "SocialLogin login handle is null"
                );
                return;
            }

            Plugin plugin =
                    pluginHandle.getInstance();

            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i(
                        "Google Activity Result",
                        "SocialLogin plugin instance is not SocialLoginPlugin"
                );
                return;
            }

            ((SocialLoginPlugin) plugin)
                    .handleGoogleLoginIntent(
                            requestCode,
                            data
                    );
        }
    }

    // =========================================================
    // APPLE LOGIN - ANDROID CALLBACK
    //
    // Apple redirects to:
    //
    // filscore://apple-callback
    //
    // Android routes that URL back to MainActivity.
    // =========================================================

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);

        Uri data = intent.getData();

        if (Intent.ACTION_VIEW.equals(intent.getAction())
                && data != null) {

            Log.i(
                    "Apple Login Intent",
                    "Received OAuth callback: " + data
            );

            PluginHandle pluginHandle =
                    getBridge().getPlugin("SocialLogin");

            if (pluginHandle == null) {
                Log.i(
                        "Apple Login Intent",
                        "SocialLogin plugin handle is null"
                );
                return;
            }

            Plugin plugin =
                    pluginHandle.getInstance();

            if (!(plugin instanceof SocialLoginPlugin)) {
                Log.i(
                        "Apple Login Intent",
                        "SocialLogin plugin instance is not SocialLoginPlugin"
                );
                return;
            }

            Log.i(
                    "Apple Login Intent",
                    "Passing callback to SocialLoginPlugin"
            );

            ((SocialLoginPlugin) plugin)
                    .handleAppleLoginIntent(intent);
        }
    }

    // =========================================================
    // REQUIRED BY CAPGO SOCIAL LOGIN
    // =========================================================

    @Override
    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {
        // Required by the SocialLogin plugin.
    }
}