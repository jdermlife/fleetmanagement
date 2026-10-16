package com.quantech.filscore.wear

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.ui.graphics.Color
import androidx.wear.compose.material3.MaterialTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SnapshotRepository.initialize(this)
        setContent {
            MaterialTheme(
                colorScheme = MaterialTheme.colorScheme.copy(
                    primary = Color(0xFFF4C64E),
                    background = Color.Black,
                    surfaceContainer = Color.Black,
                    onBackground = Color.White,
                    onSurface = Color.White
                )
            ) {
                FinHealthApp()
            }
        }
    }
}