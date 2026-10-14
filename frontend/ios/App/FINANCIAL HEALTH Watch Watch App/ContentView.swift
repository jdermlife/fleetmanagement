import SwiftUI

// MARK: - Health Ring


struct HealthRing: View {
    let value: Double
    let maximum: Double
    let title: String
    let subtitle: String
    var lineWidth: CGFloat = 10

    private var progress: Double {
        guard maximum > 0 else { return 0 }
        return min(max(value / maximum, 0), 1)
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    Color.white.opacity(0.30),
                    lineWidth: lineWidth
                )

            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    AngularGradient(
                        colors: [
                            Color(red: 1.00, green: 0.88, blue: 0.43),
                            Color(red: 0.68, green: 0.43, blue: 0.03),
                            Color(red: 1.00, green: 0.89, blue: 0.47)
                        ],
                        center: .center,
                        startAngle: .degrees(-90),
                        endAngle: .degrees(270)
                    ),
                    style: StrokeStyle(
                        lineWidth: lineWidth,
                        lineCap: .round
                    )
                )
                .rotationEffect(.degrees(-90))

            VStack(spacing: 2) {
                Text(
                    maximum >= 1000
                    ? String(format: "%.0f", value)
                    : String(format: "%.1f", value)
                )
                .font(.system(
                    size: 22,
                    weight: .bold,
                    design: .rounded
                ))
                .foregroundStyle(.white)
                .minimumScaleFactor(0.7)
                .lineLimit(1)

                Text(title)
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundStyle(Color(red: 0.85, green: 0.68, blue: 0.31))

                Text(subtitle)
                    .font(.system(size: 7))
                    .foregroundStyle(.secondary)
            }
        }
        .background(Color.black)
    }
}




// MARK: - Metric Row

struct WatchMetricRow: View {

    let title: String
    let value: String

    var body: some View {

        HStack {

            Text(title)
                .font(.caption2)

            Spacer()

            Text(value)
                .font(.caption2)
                .fontWeight(.semibold)
        }
    }
}


// MARK: - Trend Graph

struct WatchTrendGraph: View {

    let values: [Double]
    let maximum: Double

    private var normalizedValues: [Double] {

        guard !values.isEmpty, maximum > 0 else {
            return []
        }

        return values.map { value in
            min(
                max(value / maximum, 0),
                1
            )
        }
    }

    var body: some View {

        GeometryReader { geometry in

            ZStack {

                RoundedRectangle(
                    cornerRadius: 8
                )
                .fill(
                    Color.gray.opacity(0.08)
                )

                // Reference line
                Path { path in

                    let y =
                        geometry.size.height / 2

                    path.move(
                        to: CGPoint(
                            x: 0,
                            y: y
                        )
                    )

                    path.addLine(
                        to: CGPoint(
                            x: geometry.size.width,
                            y: y
                        )
                    )
                }
                .stroke(
                    Color.gray.opacity(0.15),
                    lineWidth: 1
                )

                // Trend line
                if normalizedValues.count >= 2 {

                    Path { path in

                        let width =
                            geometry.size.width

                        let height =
                            geometry.size.height

                        let step =
                            width /
                            CGFloat(
                                normalizedValues.count - 1
                            )

                        for index in
                            normalizedValues.indices {

                            let x =
                                CGFloat(index) *
                                step

                            let y =
                                height -
                                (
                                    normalizedValues[index] *
                                    height
                                )

                            let point =
                                CGPoint(
                                    x: x,
                                    y: y
                                )

                            if index == 0 {

                                path.move(
                                    to: point
                                )

                            } else {

                                path.addLine(
                                    to: point
                                )
                            }
                        }
                    }
                    .stroke(
                        Color.yellow,
                        style: StrokeStyle(
                            lineWidth: 2.5,
                            lineCap: .round,
                            lineJoin: .round
                        )
                    )
                }

                // No history message
                if normalizedValues.count < 2 {

                    Text("Awaiting history")
                        .font(
                            .system(size: 8)
                        )
                        .foregroundStyle(
                            .secondary
                        )
                }
            }
        }
        .frame(height: 65)
    }
}


// MARK: - Main Content

struct ContentView: View {

    @ObservedObject private var watchSync =
        WatchSyncReceiver.shared

    var body: some View {

        NavigationStack {

            ScrollView {

                VStack(spacing: 12) {

                    // MARK: Header

                    Text("FIN HEALTH")
                        .font(.headline)
                        .fontWeight(.light)


                    

                    // MARK: Main Concentric Rings

                   ZStack {
                       // OUTER RING — GOLD
                       WatchConcentricRing(
                           progress: min(max((watchSync.resolvedGoldRingScore ?? 0) / 100, 0), 1),
                           lineWidth: 10,
                           gradient: LinearGradient(
                               gradient: Gradient(stops: [
                                   .init(color: Color(red: 0.482, green: 0.314, blue: 0.031), location: 0),
                                   .init(color: Color(red: 0.957, green: 0.773, blue: 0.310), location: 0.24),
                                   .init(color: Color(red: 1.000, green: 0.914, blue: 0.604), location: 0.43),
                                   .init(color: Color(red: 0.839, green: 0.604, blue: 0.118), location: 0.68),
                                   .init(color: Color(red: 0.518, green: 0.333, blue: 0.031), location: 1)
                               ]),
                               startPoint: .topLeading,
                               endPoint: .bottomTrailing
                           )
                       )
                       .frame(width: 145, height: 145)

                       // MIDDLE RING — SILVER
                       WatchConcentricRing(
                           progress: min(max((watchSync.resolvedSilverRingScore ?? 0) / 100, 0), 1),
                           lineWidth: 9,
                           gradient: LinearGradient(
                               gradient: Gradient(stops: [
                                   .init(color: Color(red: 0.396, green: 0.420, blue: 0.451), location: 0),
                                   .init(color: Color(red: 0.835, green: 0.851, blue: 0.871), location: 0.24),
                                   .init(color: Color(red: 0.969, green: 0.973, blue: 0.976), location: 0.43),
                                   .init(color: Color(red: 0.678, green: 0.702, blue: 0.729), location: 0.68),
                                   .init(color: Color(red: 0.408, green: 0.431, blue: 0.463), location: 1)
                               ]),
                               startPoint: .topLeading,
                               endPoint: .bottomTrailing
                           )
                       )
                       .frame(width: 116, height: 116)

                       // INNER RING — BRONZE
                       WatchConcentricRing(
                           progress: min(max((watchSync.resolvedBronzeRingScore ?? 0) / 100, 0), 1),
                           lineWidth: 8,
                           gradient: LinearGradient(
                               gradient: Gradient(stops: [
                                   .init(color: Color(red: 0.400, green: 0.196, blue: 0.075), location: 0),
                                   .init(color: Color(red: 0.776, green: 0.478, blue: 0.231), location: 0.24),
                                   .init(color: Color(red: 0.941, green: 0.678, blue: 0.439), location: 0.43),
                                   .init(color: Color(red: 0.663, green: 0.341, blue: 0.149), location: 0.68),
                                   .init(color: Color(red: 0.396, green: 0.188, blue: 0.071), location: 1)
                               ]),
                               startPoint: .topLeading,
                               endPoint: .bottomTrailing
                           )
                       )
                       .frame(width: 87, height: 87)

                       // CENTER SCORE
                       VStack(spacing: 2) {
                           Text(
                               watchSync.financialHealth.map {
                                   String(format: "%.0f", $0)
                               } ?? "--"
                           )
                           .font(.system(size: 27, weight: .bold, design: .rounded))
                           .foregroundStyle(.white)

                           Text("/ 1000")
                               .font(.system(size: 10, weight: .semibold))
                               .foregroundStyle(.gray)
                       }
                   }
                   .frame(width: 155, height: 155)
                   .background(Color.black)



                        // Wealth Building
                        HealthRing(
                            value:
                                watchSync.wealthBuilding ?? 0,
                            maximum: 100,
                            title: "WEALTH",
                            subtitle: "CAPACITY",
                            lineWidth: 7
                        )
                        .frame(
                            width: 105,
                            height: 105
                        )
                    }


                    // MARK: Last Updated

                    if let updated =
                        watchSync.lastUpdated {

                        Text(
                            "Updated " +
                            updated.formatted(
                                date: .abbreviated,
                                time: .shortened
                            )
                        )
                        .font(
                            .system(size: 8)
                        )
                        .foregroundStyle(
                            .secondary
                        )
                    }


                    Divider()


                    // MARK: Financial Health

                    NavigationLink {

                        FinancialHealthDetailView()

                    } label: {

                        ScoreCard(
                            title: "Financial Health",
                            value:
                                watchSync.financialHealth.map {
                                    String(
                                        format: "%.0f",
                                        $0
                                    )
                                } ?? "--",
                            subtitle: "Health Score"
                        )
                    }
                    .buttonStyle(.plain)


                    // MARK: Budget & Expenses

                    NavigationLink {

                        BudgetWatchView()

                    } label: {

                        ScoreCard(
                            title: "Budget & Expenses",
                            value:
                                watchSync.budgetScore.map {
                                    String(
                                        format: "%.0f",
                                        $0
                                    )
                                } ?? "--",
                            subtitle: "Budget Health"
                        )
                    }
                    .buttonStyle(.plain)


                    // MARK: Credit Health

                    NavigationLink {

                        CreditHealthWatchView()

                    } label: {

                        ScoreCard(
                            title: "Credit Health",
                            value:
                                watchSync.creditScore.map {
                                    String(
                                        format: "%.0f",
                                        $0
                                    )
                                } ?? "--",
                            subtitle: "Credit Score"
                        )
                    }
                    .buttonStyle(.plain)


                    // MARK: Wealth Building

                    NavigationLink {

                        WealthWatchView()

                    } label: {

                        ScoreCard(
                            title: "Wealth Capacity",
                            value:
                                watchSync.wealthBuilding.map {
                                    String(
                                        format: "%.1f",
                                        $0
                                    )
                                } ?? "--",
                            subtitle: "Building Capacity"
                        )
                    }
                    .buttonStyle(.plain)


                    Divider()


                    // MARK: Net Worth

                    if let netWorth =
                        watchSync.netWorth {

                        VStack(spacing: 3) {

                            Text("Net Worth")
                                .font(.caption2)

                            Text(
                                "₱\(netWorth, specifier: "%.0f")"
                            )
                            .font(.headline)

                            Text("Current Position")
                                .font(.caption2)
                                .foregroundStyle(
                                    .secondary
                                )
                        }
                        .padding(.vertical, 5)
                    }
                }
                .padding(.horizontal, 6)
            }
            .navigationTitle("FIN HEALTH")
        }
    }



// MARK: - Budget & Expenses

struct BudgetWatchView: View {

    @ObservedObject private var watchSync =
        WatchSyncReceiver.shared

    var body: some View {

        ScrollView {

            VStack(spacing: 12) {

                Text("BUDGET")
                    .font(.headline)
                    .fontWeight(.bold)


                // Budget Ring

                HealthRing(
                    value:
                        watchSync.budgetScore ?? 0,
                    maximum: 100,
                    title: "BUDGET",
                    subtitle: "HEALTH",
                    lineWidth: 11
                )
                .frame(
                    width: 125,
                    height: 125
                )


                Divider()


                // Income

                WatchMetricRow(
                    title: "Income",
                    value: money(
                        watchSync.monthlyIncome
                    )
                )


                // Expenses

                WatchMetricRow(
                    title: "Expenses",
                    value: money(
                        watchSync.monthlyExpenses
                    )
                )


                // Net Cash Flow

                WatchMetricRow(
                    title: "Net Cash Flow",
                    value: money(
                        watchSync.monthlyCashFlow
                    )
                )


                Divider()


                Text("Budget Health Trend")
                    .font(.caption)
                    .fontWeight(.semibold)

                WatchTrendGraph(
                    values:
                        watchSync.budgetTrend,
                    maximum: 100
                )


                VStack(spacing: 4) {

                    Text("Expense Monitoring")
                        .font(.caption)
                        .fontWeight(.semibold)

                    Text(
                        "Data synchronized from FINANCIAL HEALTH"
                    )
                    .font(.system(size: 8))
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(
                        .center
                    )
                }
            }
            .padding()
        }
        .navigationTitle("Budget")
    }

    private func money(
        _ value: Double?
    ) -> String {

        guard let value else {
            return "--"
        }

        return "₱" + String(
            format: "%.0f",
            value
        )
    }
}


// MARK: - Credit Health

struct CreditHealthWatchView: View {

    @ObservedObject private var watchSync =
        WatchSyncReceiver.shared

    var body: some View {

        ScrollView {

            VStack(spacing: 10) {

                Text("CREDIT HEALTH")
                    .font(.headline)
                    .fontWeight(.bold)

                ZStack {
                    CreditHealthConcentricRing(
                        score: watchSync.creditScore,
                        lineWidth: 9,
                        trackColor: Color(red: 0.231, green: 0.510, blue: 0.965),
                        gradient: creditGradient
                    )
                    .frame(width: 156, height: 156)

                    CreditHealthConcentricRing(
                        score: watchSync.creditBureauScore,
                        lineWidth: 9,
                        trackColor: Color(red: 0.078, green: 0.722, blue: 0.651),
                        gradient: creditBureauGradient
                    )
                    .frame(width: 130, height: 130)

                    CreditHealthConcentricRing(
                        score: watchSync.nonStarterScore,
                        lineWidth: 9,
                        trackColor: Color(red: 0.937, green: 0.267, blue: 0.267),
                        gradient: nonStarterGradient
                    )
                    .frame(width: 104, height: 104)

                    CreditHealthConcentricRing(
                        score: watchSync.socialScore,
                        lineWidth: 9,
                        trackColor: Color(red: 0.980, green: 0.800, blue: 0.082),
                        gradient: socialGradient
                    )
                    .frame(width: 78, height: 78)

                    CreditHealthConcentricRing(
                        score: watchSync.psychometricScore,
                        lineWidth: 8,
                        trackColor: .white,
                        gradient: psychometricGradient
                    )
                    .frame(width: 52, height: 52)

                    VStack(spacing: 1) {
                        Text("FILSCORE")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)

                        Text("Credit Health")
                            .font(.system(size: 7, weight: .medium))
                            .foregroundStyle(.white)
                    }
                }
                .frame(width: 164, height: 164)


                Divider()


                WatchMetricRow(
                    title: "Credit Score",
                    value: filscoreText(
                        watchSync.creditScore
                    )
                )

                WatchMetricRow(
                    title: "Credit Bureau",
                    value: filscoreText(
                        watchSync.creditBureauScore
                    )
                )

                WatchMetricRow(
                    title: "Behaviour",
                    value: filscoreText(
                        watchSync.psychometricScore
                    )
                )


                WatchMetricRow(
                    title: "Social",
                    value: filscoreText(
                        watchSync.socialScore
                    )
                )


                WatchMetricRow(
                    title: "Non-Starter",
                    value: filscoreText(
                        watchSync.nonStarterScore
                    )
                )


                Divider()


                Text("Credit Health Trend")
                    .font(.caption)
                    .fontWeight(.semibold)

                WatchTrendGraph(
                    values:
                        watchSync.creditHealthTrend.map {
                            filscore($0)
                        },
                    maximum: 1000
                )
            }
            .padding()
        }
        .navigationTitle("Credit")
    }

    private func filscoreText(
        _ value: Double?
    ) -> String {

        guard let value else {
            return "--"
        }

        return String(
            format: "%.0f",
            filscore(value)
        )
    }

    private func filscore(_ value: Double) -> Double {
        200 + (min(max(value, 0), 100) * 7)
    }

    private var creditGradient: LinearGradient {
        scoreGradient("#bfdbfe", "#60a5fa", "#2563eb", "#1e3a8a")
    }

    private var creditBureauGradient: LinearGradient {
        scoreGradient("#ccfbf1", "#5eead4", "#0d9488", "#134e4a")
    }

    private var nonStarterGradient: LinearGradient {
        scoreGradient("#fecaca", "#fb7185", "#dc2626", "#7f1d1d")
    }

    private var socialGradient: LinearGradient {
        scoreGradient("#fef9c3", "#fde047", "#eab308", "#a16207")
    }

    private var psychometricGradient: LinearGradient {
        scoreGradient("#ffffff", "#f8fafc", "#dbe4ee", "#94a3b8")
    }

    private func scoreGradient(
        _ first: String,
        _ second: String,
        _ third: String,
        _ fourth: String
    ) -> LinearGradient {
        LinearGradient(
            gradient: Gradient(stops: [
                .init(color: Color(hex: first), location: 0),
                .init(color: Color(hex: second), location: 0.30),
                .init(color: Color(hex: third), location: 0.68),
                .init(color: Color(hex: fourth), location: 1)
            ]),
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
    }
}


// MARK: - Wealth Building Capacity

struct WealthWatchView: View {

    @ObservedObject private var watchSync =
        WatchSyncReceiver.shared

    var body: some View {

        ScrollView {

            VStack(spacing: 10) {

                Text("WEALTH CAPACITY")
                    .font(.headline)
                    .fontWeight(.bold)


                // Main Wealth Ring

                HealthRing(
                    value:
                        watchSync.wealthBuilding ?? 0,
                    maximum: 100,
                    title: "WEALTH",
                    subtitle: "CAPACITY",
                    lineWidth: 12
                )
                .frame(
                    width: 135,
                    height: 135
                )


                Divider()


                // Net Worth

                WatchMetricRow(
                    title: "Net Worth",
                    value: money(
                        watchSync.netWorth
                    )
                )


                // Liquidity

                WatchMetricRow(
                    title: "Liquidity",
                    value: score(
                        watchSync.liquidityBuffer
                    )
                )


                // Cash Flow

                WatchMetricRow(
                    title: "Cash Flow",
                    value: score(
                        watchSync.cashFlowStrength
                    )
                )


                // Leverage

                WatchMetricRow(
                    title: "Leverage",
                    value: score(
                        watchSync.leverageControl
                    )
                )


                // Emergency

                WatchMetricRow(
                    title: "Emergency",
                    value: score(
                        watchSync.emergencyReadiness
                    )
                )


                // Investment

                WatchMetricRow(
                    title: "Investment",
                    value: score(
                        watchSync.investmentReadiness
                    )
                )


                // Retirement

                WatchMetricRow(
                    title: "Retirement",
                    value: score(
                        watchSync.retirementReadiness
                    )
                )


                // Financial Independence

                WatchMetricRow(
                    title: "Independence",
                    value: score(
                        watchSync.financialIndependence
                    )
                )


                // Goal Momentum

                WatchMetricRow(
                    title: "Goal Momentum",
                    value: score(
                        watchSync.goalMomentum
                    )
                )


                // Protection

                WatchMetricRow(
                    title: "Protection",
                    value: score(
                        watchSync.protectionCoverage
                    )
                )


                Divider()


                Text("Wealth Capacity Trend")
                    .font(.caption)
                    .fontWeight(.semibold)

                WatchTrendGraph(
                    values:
                        watchSync.wealthBuildingTrend,
                    maximum: 100
                )
            }
            .padding()
        }
        .navigationTitle("Wealth")
    }

    private func score(
        _ value: Double?
    ) -> String {

        guard let value else {
            return "--"
        }

        return String(
            format: "%.0f",
            value
        )
    }

    private func money(
        _ value: Double?
    ) -> String {

        guard let value else {
            return "--"
        }

        return "₱" + String(
            format: "%.0f",
            value
        )
    }
}


// MARK: - Score Card

struct ScoreCard: View {

    let title: String
    let value: String
    let subtitle: String

    var body: some View {

        VStack(spacing: 4) {

            Text(title)
                .font(.caption2)
                .fontWeight(.semibold)

            Text(value)
                .font(
                    .system(
                        size: 30,
                        weight: .bold
                    )
                )

            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }
}


// MARK: - Financial Health Detail

struct FinancialHealthDetailView: View {

    @ObservedObject private var watchSync =
        WatchSyncReceiver.shared

    var body: some View {

        ScrollView {

            VStack(spacing: 12) {

                HealthRing(
                    value:
                        watchSync.financialHealth ?? 0,
                    maximum: 1000,
                    title: "FINANCIAL",
                    subtitle: "HEALTH",
                    lineWidth: 11
                )
                .frame(
                    width: 130,
                    height: 130
                )


                Text(
                    watchSync.financialHealth.map {
                        String(
                            format: "%.0f",
                            $0
                        )
                    } ?? "--"
                )
                .font(
                    .system(
                        size: 32,
                        weight: .bold
                    )
                )


                Text("Financial Health")
                    .font(.headline)


                Divider()


                Text("Health Trend")
                    .font(.caption)
                    .fontWeight(.semibold)


                WatchTrendGraph(
                    values:
                        watchSync.financialHealthTrend,
                    maximum: 1000
                )


                Text(
                    "Your overall financial health score."
                )
                .font(.caption)
                .multilineTextAlignment(
                    .center
                )


                Text("On Track")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            .padding()
        }
        .navigationTitle("Health")
    }
}

struct WatchConcentricRing: View {
    let progress: Double
    let lineWidth: CGFloat
    let gradient: LinearGradient

    var body: some View {
        ZStack {
            // Background track
            Circle()
                .stroke(
                    Color.gray.opacity(0.40),
                    lineWidth: lineWidth
                )

            if progress > 0 {
                Circle()
                    .trim(from: 0, to: min(max(progress, 0.0), 1.0))
                    .stroke(
                        gradient,
                        style: StrokeStyle(
                            lineWidth: lineWidth,
                            lineCap: .round
                        )
                    )
                    .rotationEffect(.degrees(-90))
            }
        }
    }
}

struct CreditHealthConcentricRing: View {
    let score: Double?
    let lineWidth: CGFloat
    let trackColor: Color
    let gradient: LinearGradient

    private var progress: Double {
        guard let score else { return 0 }
        let filscore = 200 + (min(max(score, 0), 100) * 7)
        return filscore / 1000
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(trackColor.opacity(0.18), lineWidth: lineWidth)

            if progress > 0 {
                Circle()
                    .trim(from: 0, to: progress)
                    .stroke(
                        gradient,
                        style: StrokeStyle(
                            lineWidth: lineWidth,
                            lineCap: .round
                        )
                    )
                    .rotationEffect(.degrees(-90))
            }
        }
    }
}

private extension Color {
    init(hex: String) {
        let value = UInt64(hex.dropFirst(), radix: 16) ?? 0
        self.init(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
}





// MARK: - Preview

#Preview {
    ContentView()
}

