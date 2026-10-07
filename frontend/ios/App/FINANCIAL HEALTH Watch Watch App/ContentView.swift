import SwiftUI

// MARK: - Health Ring

struct HealthRing: View {

    let value: Double
    let maximum: Double
    let title: String
    let subtitle: String

    var lineWidth: CGFloat = 10

    private var progress: Double {
        guard maximum > 0 else {
            return 0
        }

        return min(
            max(value / maximum, 0),
            1
        )
    }

    var body: some View {

        ZStack {

            // Background ring
            Circle()
                .stroke(
                    Color.gray.opacity(0.18),
                    lineWidth: lineWidth
                )

            // Progress ring
            Circle()
                .trim(
                    from: 0,
                    to: progress
                )
                .stroke(
                    Color.yellow,
                    style: StrokeStyle(
                        lineWidth: lineWidth,
                        lineCap: .round
                    )
                )
                .rotationEffect(.degrees(-90))

            // Center
            VStack(spacing: 1) {

                Text(
                    maximum >= 1000
                    ? String(format: "%.0f", value)
                    : String(format: "%.1f", value)
                )
                .font(
                    .system(
                        size: 22,
                        weight: .bold,
                        design: .rounded
                    )
                )

                Text(title)
                    .font(
                        .system(
                            size: 8,
                            weight: .semibold
                        )
                    )

                Text(subtitle)
                    .font(.system(size: 7))
                    .foregroundStyle(.secondary)
            }
        }
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

                    Text("FINANCIAL HEALTH")
                        .font(.headline)
                        .fontWeight(.bold)


                    // MARK: Main Concentric Rings

                    ZStack {

                        // Financial Health
                        HealthRing(
                            value:
                                watchSync.financialHealth ?? 0,
                            maximum: 1000,
                            title: "FINANCIAL",
                            subtitle: "HEALTH",
                            lineWidth: 11
                        )
                        .frame(
                            width: 145,
                            height: 145
                        )


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


                // Credit Health Ring

                HealthRing(
                    value:
                        watchSync.creditScore ?? 0,
                    maximum: 1000,
                    title: "CREDIT",
                    subtitle: "HEALTH",
                    lineWidth: 11
                )
                .frame(
                    width: 125,
                    height: 125
                )


                Divider()


                WatchMetricRow(
                    title: "Credit Score",
                    value: score(
                        watchSync.creditScore
                    )
                )


                WatchMetricRow(
                    title: "Behaviour",
                    value: score(
                        watchSync.psychometricScore
                    )
                )


                WatchMetricRow(
                    title: "Social",
                    value: score(
                        watchSync.socialScore
                    )
                )


                WatchMetricRow(
                    title: "Non-Starter",
                    value: score(
                        watchSync.nonStarterScore
                    )
                )


                Divider()


                Text("Credit Health Trend")
                    .font(.caption)
                    .fontWeight(.semibold)

                WatchTrendGraph(
                    values:
                        watchSync.creditHealthTrend,
                    maximum: 1000
                )
            }
            .padding()
        }
        .navigationTitle("Credit")
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


// MARK: - Preview

#Preview {
    ContentView()
}
