package com.quantech.filscore.wear

import com.google.android.gms.wearable.DataEventBuffer
import com.google.android.gms.wearable.WearableListenerService

class SnapshotListenerService : WearableListenerService() {
    override fun onDataChanged(dataEvents: DataEventBuffer) {
        SnapshotRepository.onDataChanged(this, dataEvents)
    }
}