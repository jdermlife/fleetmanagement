package com.quantech.filscore.wear

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
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
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.wear.compose.material3.Text
import java.text.NumberFormat
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin

private enum class Screen { HOME, HEALTH, BUDGET, CREDIT, WEALTH, RESOURCE, BILLS }

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
        Screen.RESOURCE -> ResourceOptimizerScreen(snapshot) { screen = Screen.HOME }
        Screen.BILLS -> BillCalendarScreen(snapshot) { screen = Screen.HOME }
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
        WearDivider()
        NavigationRow("Financial Health", score(snapshot.financialHealth), "Health Score") { navigate(Screen.HEALTH) }
        NavigationRow("Budget & Expenses", score(snapshot.budgetScore), "Budget Health") { navigate(Screen.BUDGET) }
        NavigationRow("Credit Health", score(snapshot.creditScore), "Credit Score") { navigate(Screen.CREDIT) }
        NavigationRow("Wealth Capacity", decimal(snapshot.wealthBuilding), "Building Capacity") { navigate(Screen.WEALTH) }
        NavigationRow("Resource Optimizer", snapshot.resourceOptimizerScore?.let { "${decimal(it)}%" } ?: "NA", "Loan Health") { navigate(Screen.RESOURCE) }
        NavigationRow("Bill Manager", snapshot.latePaymentCount.toString(), "Late Payments") { navigate(Screen.BILLS) }
        snapshot.netWorth?.let {
            WearDivider()
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
        WearDivider()
        Text("Health Trend", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        TrendGraph(snapshot.financialHealthTrend, 1000.0)
        Text("Your overall financial health score.", fontSize = 10.sp, textAlign = TextAlign.Center)
        Text("On Track", fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun BudgetScreen(snapshot: WatchSnapshot, onBack: () -> Unit) {
    ScreenColumn("BUDGET", onBack) {
        BudgetUtilizationGraph(snapshot)
        WearDivider()
        MetricRow("Income", money(snapshot.monthlyIncome))
        MetricRow("Expenses", money(snapshot.monthlyExpenses))
        MetricRow("Net Cash Flow", money(snapshot.monthlyCashFlow))
        WearDivider()
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
        WearDivider()
        MetricRow("Credit Score", score(snapshot.creditFilscore))
        MetricRow("Credit Bureau", score(snapshot.creditBureauFilscore))
        MetricRow("Behaviour", score(snapshot.psychometricFilscore))
        MetricRow("Social", score(snapshot.socialFilscore))
        MetricRow("Non-Starter", score(snapshot.nonStarterFilscore))
        WearDivider()
        Text("Credit Health Trend", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        TrendGraph(snapshot.creditHealthTrend, 1000.0)
    }
}

@Composable
private fun WealthScreen(snapshot: WatchSnapshot, onBack: () -> Unit) {
    ScreenColumn("WEALTH CAPACITY", onBack) {
        WealthRadarGraph(snapshot)
        WearDivider()
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
        WearDivider()
        Text("Wealth Capacity Trend", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
        TrendGraph(snapshot.wealthBuildingTrend, 100.0)
    }
}

@Composable
private fun BudgetUtilizationGraph(snapshot: WatchSnapshot) {
    Column(
        modifier = Modifier.fillMaxWidth().background(Color(0xFF1C2E1A), shape = androidx.compose.foundation.shape.RoundedCornerShape(8.dp)).padding(9.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.Bottom) {
            Column(modifier = Modifier.weight(1f)) {
                Text("BUDGET PERFORMANCE", color = Color(0xFFF1C840), fontSize = 7.sp, fontWeight = FontWeight.Bold)
                Text("Budget Utilization", fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            Text(snapshot.utilizationPercent?.let { "${decimal(it)}%" } ?: "NA", color = Color(0xFF62E38C), fontSize = 19.sp, fontWeight = FontWeight.Bold)
        }
        Box(modifier = Modifier.fillMaxWidth().height(15.dp).background(Color(0xFFB76736), CircleShape)) {
            Box(
                modifier = Modifier
                    .fillMaxWidth(((snapshot.budgetProgressPercent ?: 0.0) / 100.0).coerceIn(0.0, 1.0).toFloat())
                    .height(15.dp)
                    .background(Brush.horizontalGradient(listOf(Color(0xFF20B772), Color(0xFFF0BD2E), Color(0xFFEC714C))), CircleShape)
            )
        }
        if ((snapshot.budgetOverflowPercent ?: 0.0) > 0) {
            Box(modifier = Modifier.fillMaxWidth().height(3.dp).background(Color(0xFF442725))) {
                Box(modifier = Modifier.fillMaxWidth(((snapshot.budgetOverflowPercent ?: 0.0) / 100.0).coerceIn(0.0, 1.0).toFloat()).height(3.dp).background(Color(0xFFEC714C)))
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Used ${money(snapshot.utilizedAmount)}", fontSize = 8.sp)
            Text("Budget ${money(snapshot.budgetAmount)}", fontSize = 8.sp)
        }
        Text(
            if ((snapshot.utilizationPercent ?: 0.0) > 100) "${money(snapshot.overBudgetAmount)} over budget" else "${money(snapshot.remainingAmount)} remaining",
            fontSize = 9.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.fillMaxWidth(),
            textAlign = TextAlign.Center
        )
        snapshot.budgetSourceLabel?.let { Text(it, color = Color.Gray, fontSize = 7.sp, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center) }
    }
}

@Composable
private fun WealthRadarGraph(snapshot: WatchSnapshot) {
    val values = listOf(
        (((snapshot.wealthNetWorthPositioning ?: 200.0) - 200.0) / 700.0).coerceIn(0.0, 1.0),
        ((snapshot.wealthBehaviour ?: 0.0) / 100.0).coerceIn(0.0, 1.0),
        ((snapshot.wealthFoundation ?: 0.0) / 1000.0).coerceIn(0.0, 1.0),
        ((snapshot.wealthAuthenticity ?: 0.0) / 100.0).coerceIn(0.0, 1.0)
    )
    Canvas(modifier = Modifier.size(155.dp).background(Color(0xFF102432))) {
        val center = Offset(size.width / 2, size.height / 2)
        val radius = size.minDimension * 0.40f
        fun point(index: Int, scale: Double): Offset {
            val angle = -PI / 2 + index * PI / 2
            return Offset(
                center.x + (cos(angle) * radius * scale).toFloat(),
                center.y + (sin(angle) * radius * scale).toFloat()
            )
        }
        listOf(0.25, 0.5, 0.75, 1.0).forEach { level ->
            val path = Path()
            repeat(4) { index ->
                val position = point(index, level)
                if (index == 0) path.moveTo(position.x, position.y) else path.lineTo(position.x, position.y)
            }
            path.close()
            drawPath(path, Color(0xFF6E8498), style = Stroke(1.dp.toPx()))
        }
        val axisColors = listOf(Color(0xFF166534), Color(0xFFD4A72C), Color(0xFF1E3A8A), Color.White)
        repeat(4) { index -> drawLine(axisColors[index], center, point(index, 1.0), 1.dp.toPx()) }
        val scorePath = Path()
        values.forEachIndexed { index, value ->
            val position = point(index, value)
            if (index == 0) scorePath.moveTo(position.x, position.y) else scorePath.lineTo(position.x, position.y)
        }
        scorePath.close()
        drawPath(scorePath, Color(0x55E0B02D))
        drawPath(scorePath, Color(0xFFE0B02D), style = Stroke(2.dp.toPx()))
        values.forEachIndexed { index, value -> drawCircle(axisColors[index], 4.dp.toPx(), point(index, value)) }
    }
}

@Composable
private fun ResourceOptimizerScreen(snapshot: WatchSnapshot, onBack: () -> Unit) {
    ScreenColumn("RESOURCE OPTIMIZER", onBack) {
        ResourceGauge(snapshot.resourceOptimizerScore)
        Text(snapshot.resourceOptimizerScore?.let { "${decimal(it)}%" } ?: "NA", fontSize = 28.sp, fontWeight = FontWeight.Bold)
        Text(snapshot.resourceOptimizerStatus ?: "Loan health optimization", color = Color.Gray, fontSize = 9.sp, textAlign = TextAlign.Center)
    }
}

@Composable
private fun ResourceGauge(value: Double?) {
    Canvas(modifier = Modifier.fillMaxWidth().height(125.dp)) {
        val stroke = 15.dp.toPx()
        val diameter = size.minDimension * 1.15f
        val topLeft = Offset((size.width - diameter) / 2, size.height * 0.12f)
        val arcSize = Size(diameter, diameter)
        drawArc(Color(0xFFEF2929), 150f, 80f, false, topLeft, arcSize, style = Stroke(stroke))
        drawArc(Color(0xFFFFA000), 230f, 80f, false, topLeft, arcSize, style = Stroke(stroke))
        drawArc(Color(0xFF22C97A), 310f, 80f, false, topLeft, arcSize, style = Stroke(stroke))
        val center = Offset(size.width / 2, topLeft.y + diameter / 2)
        val angle = (150.0 + ((value ?: 0.0) / 100.0).coerceIn(0.0, 1.0) * 240.0) * PI / 180.0
        val needleLength = diameter * 0.34f
        val needle = Offset(center.x + (cos(angle) * needleLength).toFloat(), center.y + (sin(angle) * needleLength).toFloat())
        drawLine(Color.White, center, needle, 3.dp.toPx(), StrokeCap.Round)
        drawCircle(Color.White, 6.dp.toPx(), center)
    }
}

@Composable
private fun BillCalendarScreen(snapshot: WatchSnapshot, onBack: () -> Unit) {
    val month = runCatching { YearMonth.parse(snapshot.billSnapshotMonth?.take(7)) }.getOrElse { YearMonth.now() }
    val leading = month.atDay(1).dayOfWeek.value % 7
    val cells: List<Int?> = List(leading) { null } + (1..month.lengthOfMonth()).map { it }
    ScreenColumn("BILL MANAGER", onBack) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(month.format(DateTimeFormatter.ofPattern("MMM yyyy", Locale.US)), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            Text("${snapshot.latePaymentCount} late", color = if (snapshot.latePaymentCount > 0) Color.Red else Color.Green, fontSize = 9.sp)
        }
        Row(modifier = Modifier.fillMaxWidth()) {
            listOf("S", "M", "T", "W", "T", "F", "S").forEach { Text(it, modifier = Modifier.weight(1f), color = Color.Gray, fontSize = 7.sp, textAlign = TextAlign.Center) }
        }
        cells.chunked(7).forEach { week ->
            Row(modifier = Modifier.fillMaxWidth()) {
                (week + List(7 - week.size) { null }).forEach { day ->
                    Box(
                        modifier = Modifier.weight(1f).height(18.dp).background(if (day == month.lengthOfMonth()) Color(0x55F4C64E) else Color.White.copy(alpha = 0.06f)),
                        contentAlignment = Alignment.Center
                    ) { Text(day?.toString() ?: "", fontSize = 8.sp) }
                }
            }
        }
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
private fun WearDivider() {
    Spacer(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(Color.White.copy(alpha = 0.16f))
    )
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