package com.quantech.filscore;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;

@CapacitorPlugin(name = "WatchSync")
public class WatchSyncPlugin extends Plugin {
    private static final String DATA_PATH = "/financial-health/snapshot";
    private static final String DATA_KEY = "snapshot";
    private static final String PREFERENCES = "wear_sync";
    private static final String SNAPSHOT_KEY = "latest_snapshot";

    @PluginMethod
    public void updateSnapshot(PluginCall call) {
        JSObject snapshot = call.getObject("snapshot");
        if (snapshot == null) {
            call.reject("snapshot is required");
            return;
        }

        String snapshotJson = snapshot.toString();
        Context context = getContext();
        SharedPreferences preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE);
        preferences.edit().putString(SNAPSHOT_KEY, snapshotJson).apply();

        if (GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context)
                != ConnectionResult.SUCCESS) {
            call.resolve(result(true, false));
            return;
        }

        PutDataMapRequest dataMapRequest = PutDataMapRequest.create(DATA_PATH);
        dataMapRequest.getDataMap().putString(DATA_KEY, snapshotJson);
        dataMapRequest.getDataMap().putLong("revision", System.currentTimeMillis());
        PutDataRequest request = dataMapRequest.asPutDataRequest().setUrgent();

        Wearable.getDataClient(context)
                .putDataItem(request)
                .addOnSuccessListener(dataItem -> call.resolve(result(true, true)))
                .addOnFailureListener(error -> call.resolve(result(true, false)));
    }

    private JSObject result(boolean saved, boolean sent) {
        JSObject result = new JSObject();
        result.put("saved", saved);
        result.put("sent", sent);
        return result;
    }
}