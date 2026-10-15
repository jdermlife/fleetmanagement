package com.quantech.filscore.wear

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.material3.HorizontalDivider
import androidx.wear.compose.material3.Text
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

private enum class Screen { HOME, HEALTH, BUDGET, CREDIT, WEALTH }

private val gold = listOf(Color(0xFF7B5008), Color(0xFFF4C64F), Color(0xFFFFE99A), Color(0xFFD69A1E))
private val silver = listOf(Color(0xFF656B73), Color(0xFFD5D9DE), Color(0xFFF7F8F9), Color(0xFFADB3BA))
private val bronze = listOf(Color(0xFF663213), Color(0xFFC67A3B), Color(0xFFF0AD70), Color(0xFFA95726))
private val scoreGold = listOf(Color(0xFFFFE16D), Color(0xFFAD6E08), Color(0xFFFFE578))

@Composable
fun FinHealthApp() {
    val snapshot by SnapshotRepository.snapshot.collectAsStateWithLifecycle()
    var screen by remember { mutableStateOf(Screen.HOME) }
    BackHandler(enabled = screen != Screen.HOME) { screen = Screen.HOME }

    when (screen) {
        Screen.HOME -> HomeScreen(snapshot) { screen = it }
        Screen.HEALTH -> HealthScreen(snapshot) { screen = Screen.HOME }
        Screen.BUDGET -> BudgetScreen(snapshot) { screen = Screen.HOME }
        Screen.CREDIT -> CreditScreen(snapshot) { screen = Screen.HOME }
        Screen.WEALTH -> WealthScreen(snapshot) { screen = Screen.HOME }
    }
}

@Composable
private fun ScreenColumn(title: String, onBack: (() -> Unit)? = null, content: @Composable () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 14.dp, vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            if (onBack != null) {
                Text(
                    text = "<",
                    modifier = Modifier
                        .size(32.dp)
                        .clickable(onClick = onBack)
                        .padding(7.dp),
                    color = Color(0xFFF4C64E),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold
                )
            }
            Text(
                text = title,
                modifier = Modifier.weight(1f).padding(end = if (onBack != null) 32.dp else 0.dp),
                textAlign = TextAlign.Center,
                fontSize = 14.sp,
                fontWeight = FontWeight.Bold
            )
        }
        content()
        Spacer(Modifier.height(18.dp))
    }
}

@Composable
private fun HomeScreen(snapshot: WatchSnapshot, navigate: (Screen) -> Unit) {
    ScreenColumn("FIN HEALTH") {
        ConcentricHealthRings(snapshot)
        HealthRing(snapshot.wealthBuilding, 100.0, "WEALTH", "CAPACITY", 105)
        snapshot.updatedAt?.let {
            Text("Updated ${formatUpdatedAt(it)}", color = Color.Gray, fontSize = 9.sp)
        }
        HorizontalDivider()
        NavigationRow("Financial Health", score(snapshot.financialHealth), "Health Score") { navigate(Screen.HEALTH) }
        NavigationRow("Budget & Expenses", score(snapshot.budgetScore), "Budget Health") { navigate(Screen.BUDGET) }
        NavigationRow("Credit Health", score(snapshot.creditScore), "Credit Score") { navigate(Screen.CREDIT) }
        NavigationRow("Wealth Capacity", decimal(snapshot.wealthBuilding), "Building Capacity") { navigate(Screen.WEALTH) }
        snapshot.netWorth?.let {
            HorizontalDivider()
            Text("Net Worth", fontSize = 11.sp)
            Text(money(it), fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text("Current Position", color = Color.Gray, fontSize = 9.sp)
        }
    }
}

@Composable
private fun NavigationRow(title: String, value: String, subtitle: String, onClick: () -> Unit) {
    Column(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 7.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(title, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        Text(value, fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Text(subtitle, color = Color.Gray, fontSize = 9.sp)
    }
}

@Composable
private fun HealthScreen(snapshot: WatchSnapshot, onBack: () -> Unit) {
    ScreenColumn("HEALTH", onBack) {
        HealthRing(snapshot.financialHealth, 1000.0, "FINANCIAL", "HEALTH", 130)
        Text(score(snapshot.financialHealth), fontSize = 30.sp, fontWeight = FontWeight.Bold)
        Text("Financial Health", fontWeight = FontWeight.Bold)
        HorizontalDivider()
        Text("Health Trend", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        TrendGraph(snapshot.financialHealthTrend, 1000.0)
        Text("Your overall financial health score.", fontSize = 10.sp, textAlign = TextAlign.Center)
        Text("On Track", fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun BudgetScreen(snapshot: WatchSnapshot, onBack: () -> Unit) {
    ScreenColumn("BUDGET", onBack) {
        HealthRing(snapshot.budgetScore, 100.0, "BUDGET", "HEALTH", 125)
        HorizontalDivider()
        MetricRow("Income", money(snapshot.monthlyIncome))
        MetricRow("Expenses", money(snapshot.monthlyExpenses))
        MetricRow("Net Cash Flow", money(snapshot.monthlyCashFlow))
        HorizontalDivider()
        Text("Budget Health Trend", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        TrendGraph(snapshot.budgetTrend, 100.0)
        Text("Expense Monitoring", fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        Text("Data synchronized from FINANCIAL HEALTH", color = Color.Gray, fontSize = 8.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun CreditScreen(snapshot: WatchSnapshot, onBack: () -> Unit) {
    ScreenColumn("CREDIT HEALTH", onBack) {
        CreditRings(snapshot)
        HorizontalDivider()
        MetricRow("Credit Score", score(snapshot.creditFilscore))
        MetricRow("Credit Bureau", score(snapshot.creditBureauFilscore))
        MetricRow("Behaviour", score(snapshot.psychometricFilscore))
        MetricRow("Social", score(snapshot.socialFilscore))
        MetricRow("Non-Starter", score(snapshot.nonStarterFilscore))
        HorizontalDivider()
        Text("Credit Health Trend", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        TrendGraph(snapshot.creditHealthTrend, 1000.0)
    }
}

@Composable
private fun WealthScreen(snapshot: WatchSnapshot, onBack: () -> Unit) {
    ScreenColumn("WEALTH CAPACITY", onBack) {
        HealthRing(snapshot.wealthBuilding, 100.0, "WEALTH", "CAPACITY", 135)
        HorizontalDivider()
        MetricRow("Net Worth", money(snapshot.netWorth))
        MetricRow("Liquidity", score(snapshot.liquidityBuffer))
        MetricRow("Cash Flow", score(snapshot.cashFlowStrength))
        MetricRow("Leverage", score(snapshot.leverageControl))
        MetricRow("Emergency", score(snapshot.emergencyReadiness))
        MetricRow("Investment", score(snapshot.investmentReadiness))
        MetricRow("Retirement", score(snapshot.retirementReadiness))
        MetricRow("Independence", score(snapshot.financialIndependence))
        MetricRow("Goal Momentum", score(snapshot.goalMomentum))
        MetricRow("Protection", score(snapshot.protectionCoverage))
        HorizontalDivider()
        Text("Wealth Capacity Trend", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        TrendGraph(snapshot.wealthBuildingTrend, 100.0)
    }
}

@Composable
private fun MetricRow(title: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(title, fontSize = 10.sp)
        Text(value, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ConcentricHealthRings(snapshot: WatchSnapshot) {
    Box(modifier = Modifier.size(155.dp), contentAlignment = Alignment.Center) {
        ProgressRing(snapshot.resolvedGoldRingScore, 100.0, 145, 10f, gold)
        ProgressRing(snapshot.resolvedSilverRingScore, 100.0, 116, 9f, silver)
        ProgressRing(snapshot.resolvedBronzeRingScore, 100.0, 87, 8f, bronze)
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(score(snapshot.financialHealth), fontSize = 27.sp, fontWeight = FontWeight.Bold)
            Text("/ 1000", color = Color.Gray, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Composable
private fun HealthRing(value: Double?, maximum: Double, title: String, subtitle: String, size: Int) {
    Box(modifier = Modifier.size(size.dp), contentAlignment = Alignment.Center) {
        ProgressRing(value, maximum, size, if (size >= 120) 11f else 7f, scoreGold)
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(if (maximum >= 1000) score(value) else decimal(value), fontSize = 21.sp, fontWeight = FontWeight.Bold)
            Text(title, color = Color(0xFFD9AD4F), fontSize = 8.sp, fontWeight = FontWeight.SemiBold)
            Text(subtitle, color = Color.Gray, fontSize = 7.sp)
        }
    }
}

@Composable
private fun ProgressRing(value: Double?, maximum: Double, size: Int, width: Float, colors: List<Color>) {
    Canvas(modifier = Modifier.size(size.dp)) {
        val stroke = width.dp.toPx()
        val inset = stroke / 2
        drawArc(
            color = Color.White.copy(alpha = 0.22f),
            startAngle = -90f,
            sweepAngle = 360f,
            useCenter = false,
            topLeft = Offset(inset, inset),
            size = Size(this.size.width - stroke, this.size.height - stroke),
            style = Stroke(stroke)
        )
        val progress = value?.div(maximum)?.coerceIn(0.0, 1.0)?.toFloat() ?: 0f
        if (progress > 0f) {
            drawArc(
                brush = Brush.sweepGradient(colors),
                startAngle = -90f,
                sweepAngle = 360f * progress,
                useCenter = false,
                topLeft = Offset(inset, inset),
                size = Size(this.size.width - stroke, this.size.height - stroke),
                style = Stroke(stroke, cap = StrokeCap.Round)
            )
        }
    }
}

@Composable
private fun CreditRings(snapshot: WatchSnapshot) {
    Box(modifier = Modifier.size(164.dp), contentAlignment = Alignment.Center) {
        CreditRing(snapshot.creditFilscore, 156, Color(0xFF3B82F6), listOf(Color(0xFFBFDBFE), Color(0xFF60A5FA), Color(0xFF1E3A8A)))
        CreditRing(snapshot.creditBureauFilscore, 130, Color(0xFF14B8A6), listOf(Color(0xFFCCFBF1), Color(0xFF5EEAD4), Color(0xFF134E4A)))
        CreditRing(snapshot.nonStarterFilscore, 104, Color(0xFFEF4444), listOf(Color(0xFFFECACA), Color(0xFFFB7185), Color(0xFF7F1D1D)))
        CreditRing(snapshot.socialFilscore, 78, Color(0xFFFACC15), listOf(Color(0xFFFEF9C3), Color(0xFFFDE047), Color(0xFFA16207)))
        CreditRing(snapshot.psychometricFilscore, 52, Color.White, listOf(Color.White, Color(0xFFDBE4EE), Color(0xFF94A3B8)))
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("FILSCORE", fontSize = 9.sp, fontWeight = FontWeight.Bold)
            Text("Credit Health", fontSize = 6.sp)
        }
    }
}

@Composable
private fun CreditRing(value: Double?, size: Int, track: Color, colors: List<Color>) {
    Canvas(modifier = Modifier.size(size.dp)) {
        val stroke = 8.dp.toPx()
        val inset = stroke / 2
        val arcSize = Size(this.size.width - stroke, this.size.height - stroke)
        drawArc(track.copy(alpha = 0.18f), -90f, 360f, false, Offset(inset, inset), arcSize, style = Stroke(stroke))
        val progress = value?.div(1000.0)?.coerceIn(0.0, 1.0)?.toFloat() ?: 0f
        if (progress > 0f) {
            drawArc(Brush.sweepGradient(colors), -90f, 360f * progress, false, Offset(inset, inset), arcSize, style = Stroke(stroke, cap = StrokeCap.Round))
        }
    }
}

@Composable
private fun TrendGraph(values: List<Double>, maximum: Double) {
    if (values.size < 2 || maximum <= 0) {
        Text("NA", modifier = Modifier.height(65.dp).fillMaxWidth(), color = Color.Gray, textAlign = TextAlign.Center)
        return
    }
    Canvas(modifier = Modifier.fillMaxWidth().height(65.dp)) {
        drawLine(Color.Gray.copy(alpha = 0.25f), Offset(0f, size.height / 2), Offset(size.width, size.height / 2))
        val step = size.width / (values.size - 1)
        for (index in 0 until values.lastIndex) {
            val first = (values[index] / maximum).coerceIn(0.0, 1.0).toFloat()
            val second = (values[index + 1] / maximum).coerceIn(0.0, 1.0).toFloat()
            drawLine(
                Color(0xFFF4C64E),
                Offset(step * index, size.height * (1f - first)),
                Offset(step * (index + 1), size.height * (1f - second)),
                strokeWidth = 2.5.dp.toPx(),
                cap = StrokeCap.Round
            )
        }
    }
}

private fun score(value: Double?): String = value?.roundToInt()?.toString() ?: "NA"
private fun decimal(value: Double?): String = value?.let { String.format(Locale.US, "%.1f", it) } ?: "NA"
private fun money(value: Double?): String = value?.let {
    "₱${NumberFormat.getNumberInstance(Locale.US).apply { maximumFractionDigits = 0 }.format(it)}"
} ?: "NA"

private fun formatUpdatedAt(value: String): String = runCatching {
    DateTimeFormatter.ofPattern("MMM d, h:mm a", Locale.US)
        .withZone(ZoneId.systemDefault())
        .format(Instant.parse(value))
}.getOrDefault(value)