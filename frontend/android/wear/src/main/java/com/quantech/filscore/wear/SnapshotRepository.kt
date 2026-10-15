package com.quantech.filscore.wear

import android.content.Context
import android.net.Uri
import com.google.android.gms.wearable.DataEvent
import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.DataMapItem
import com.google.android.gms.wearable.Wearable
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

object SnapshotRepository {
    const val DATA_PATH = "/financial-health/snapshot"
    private const val DATA_KEY = "snapshot"
    private const val PREFERENCES = "wear_snapshot"
    private const val SNAPSHOT_KEY = "latest_snapshot"

    private val mutableSnapshot = MutableStateFlow(WatchSnapshot())
    val snapshot: StateFlow<WatchSnapshot> = mutableSnapshot.asStateFlow()

    fun initialize(context: Context) {
        val appContext = context.applicationContext
        loadSaved(appContext)
        Wearable.getDataClient(appContext)
            .getDataItems(Uri.parse("wear:$DATA_PATH"))
            .addOnSuccessListener { items ->
                try {
                    for (item in items) {
                        receive(appContext, DataMapItem.fromDataItem(item).dataMap.getString(DATA_KEY))
                    }
                } finally {
                    items.release()
                }
            }
    }

    fun onDataChanged(context: Context, events: DataEventBuffer) {
        for (event in events) {
            if (event.type == DataEvent.TYPE_CHANGED && event.dataItem.uri.path == DATA_PATH) {
                receive(
                    context.applicationContext,
                    DataMapItem.fromDataItem(event.dataItem).dataMap.getString(DATA_KEY)
                )
            }
        }
    }

    private fun loadSaved(context: Context) {
        val saved = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            .getString(SNAPSHOT_KEY, null)
        if (!saved.isNullOrBlank()) {
            runCatching { WatchSnapshot.fromJson(JSONObject(saved)) }
                .onSuccess { mutableSnapshot.value = it }
        }
    }

    private fun receive(context: Context, incomingJson: String?) {
        if (incomingJson.isNullOrBlank()) return
        runCatching {
            val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
            val existing = preferences.getString(SNAPSHOT_KEY, null)
                ?.let(::JSONObject)
                ?: JSONObject()
            val merged = merge(existing, JSONObject(incomingJson))
            preferences.edit().putString(SNAPSHOT_KEY, merged.toString()).apply()
            WatchSnapshot.fromJson(merged)
        }.onSuccess { mutableSnapshot.value = it }
    }

    private fun merge(existing: JSONObject, incoming: JSONObject): JSONObject {
        val merged = JSONObject(existing.toString())
        val keys = incoming.keys()
        while (keys.hasNext()) {
            val key = keys.next()
            val incomingValue = incoming.get(key)
            val existingValue = merged.opt(key)
            merged.put(
                key,
                if (incomingValue is JSONObject && existingValue is JSONObject) {
                    merge(existingValue, incomingValue)
                } else {
                    incomingValue
                }
            )
        }
        return merged
    }
}