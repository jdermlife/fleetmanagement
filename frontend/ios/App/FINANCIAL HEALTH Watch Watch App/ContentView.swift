import SwiftUI

// MARK: - Health Ring


struct HealthRing: View {
    let value: Double?
    let maximum: Double
    let title: String
    let subtitle: String
    var lineWidth: CGFloat = 10

    private var progress: Double? {
        guard let value, maximum > 0 else { return nil }
        return min(max(value / maximum, 0), 1)
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(
                    Color.white.opacity(0.30),
                    lineWidth: lineWidth
                )

            if let progress, progress > 0 {
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
            }

            VStack(spacing: 2) {
                Text(
                    value.map {
                        maximum >= 1000
                            ? String(format: "%.0f", $0)
                            : String(format: "%.1f", $0)
                    } ?? "NA"
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
        if normalizedValues.count >= 2 {
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
            }
            .frame(height: 65)
        } else {
            Text("NA")
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(.secondary)
                .frame(maxWidth: .infinity)
                .frame(height: 65)
        }
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
                           progress: watchSync.resolvedGoldRingScore.map {
                               min(max($0 / 100, 0), 1)
                           },
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
                           progress: watchSync.resolvedSilverRingScore.map {
                               min(max($0 / 100, 0), 1)
                           },
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
                           progress: watchSync.resolvedBronzeRingScore.map {
                               min(max($0 / 100, 0), 1)
                           },
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
                               } ?? "NA"
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
                                watchSync.wealthBuilding,
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
                                } ?? "NA",
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
                                } ?? "NA",
                            subtitle: "Budget Health"
                        )
                    }
                    .buttonStyle(.plain)


                    // MARK: Bill Manager

                    NavigationLink {

                        BillManagerWatchView()

                    } label: {

                        ScoreCard(
                            title: "Bill Manager",
                            value: watchSync.billCalendarMonthLabel == nil
                                ? "NA"
                                : String(
                                    watchSync.billCalendarDays.reduce(0) {
                                        $0 + $1.billCount
                                    }
                                ),
                            subtitle: "Bills This Month"
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
                                } ?? "NA",
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
                                } ?? "NA",
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
                        watchSync.budgetScore,
                    maximum: 100,
                    title: "BUDGET",
                    subtitle: "HEALTH",
                    lineWidth: 11
                )
                .frame(
                    width: 125,
                    height: 125
                )

                BudgetUtilizationWatchView(watchSync: watchSync)


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
            return "NA"
        }

        return "₱" + String(
            format: "%.0f",
            value
        )
    }
}

struct BudgetUtilizationWatchView: View {
    @ObservedObject var watchSync: WatchSyncReceiver

    private var progressFraction: CGFloat? {
        guard let value = watchSync.budgetProgressPercent else { return nil }
        return CGFloat(min(max(value, 0), 100) / 100)
    }

    private var overflowFraction: CGFloat? {
        guard let value = watchSync.budgetOverflowPercent else { return nil }
        return CGFloat(min(max(value, 0), 100) / 100)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("BUDGET PERFORMANCE")
                .font(.system(size: 8, weight: .bold))
                .foregroundStyle(Color(red: 0.996, green: 0.843, blue: 0.667))

            HStack(alignment: .firstTextBaseline) {
                Text("Budget Utilization")
                    .font(.system(size: 12, weight: .bold))

                Spacer(minLength: 4)

                Text(percent(watchSync.utilizationPercent))
                    .font(.system(size: 17, weight: .bold, design: .rounded))
                    .foregroundStyle(Color(red: 0.525, green: 0.937, blue: 0.675))
                    .minimumScaleFactor(0.6)
                    .lineLimit(1)
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(red: 0.761, green: 0.255, blue: 0.047),
                                    Color(red: 0.984, green: 0.573, blue: 0.235),
                                    Color(red: 0.992, green: 0.729, blue: 0.455)
                                ],
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )

                    if let progressFraction, progressFraction > 0 {
                        RoundedRectangle(cornerRadius: 4)
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.086, green: 0.396, blue: 0.204),
                                        Color(red: 0.133, green: 0.773, blue: 0.369),
                                        Color(red: 0.525, green: 0.937, blue: 0.675)
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geometry.size.width * progressFraction)
                    }
                }
            }
            .frame(height: 14)

            if let overflowFraction, overflowFraction > 0 {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.white.opacity(0.12))

                        Capsule()
                            .fill(
                                LinearGradient(
                                    colors: [
                                        Color(red: 0.976, green: 0.451, blue: 0.086),
                                        Color(red: 0.937, green: 0.267, blue: 0.267)
                                    ],
                                    startPoint: .leading,
                                    endPoint: .trailing
                                )
                            )
                            .frame(width: geometry.size.width * overflowFraction)
                    }
                }
                .frame(height: 4)
            }

            VStack(alignment: .leading, spacing: 3) {
                utilizationLabel(
                    color: Color(red: 0.133, green: 0.773, blue: 0.369),
                    title: "Utilized",
                    amount: watchSync.utilizedAmount
                )
                utilizationLabel(
                    color: Color(red: 0.984, green: 0.573, blue: 0.235),
                    title: "Budget",
                    amount: watchSync.budgetAmount
                )
            }

            Text(varianceText)
                .font(.system(size: 8))
                .foregroundStyle(Color(red: 0.820, green: 0.980, blue: 0.898))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .background(Color(red: 0.059, green: 0.141, blue: 0.110).opacity(0.92))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .overlay(
            RoundedRectangle(cornerRadius: 8)
                .stroke(Color.white.opacity(0.28), lineWidth: 1)
        )
    }

    private func utilizationLabel(color: Color, title: String, amount: Double?) -> some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 1)
                .fill(color)
                .frame(width: 7, height: 7)

            Text("\(title) \(money(amount))")
                .font(.system(size: 8, weight: .semibold))
                .lineLimit(1)
        }
    }

    private func percent(_ value: Double?) -> String {
        guard let value else { return "NA" }
        return String(format: "%.1f%%", value)
    }

    private func money(_ value: Double?) -> String {
        guard let value else { return "NA" }
        return "₱" + String(format: "%.0f", value)
    }

    private var varianceText: String {
        guard
            let varianceAmount = watchSync.budgetVarianceAmount,
            let isOverBudget = watchSync.isOverBudget,
            let sourceLabel = watchSync.budgetSourceLabel
        else {
            return "NA"
        }

        let status = isOverBudget ? "over budget" : "remaining"
        return "\(money(varianceAmount)) \(status) \(sourceLabel)"
    }
}


// MARK: - Bill Manager

struct BillManagerWatchView: View {
    @ObservedObject private var watchSync = WatchSyncReceiver.shared

    private let columns = Array(
        repeating: GridItem(.flexible(), spacing: 2),
        count: 7
    )

    private let weekdays = ["S", "M", "T", "W", "T", "F", "S"]

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Text("BILL MANAGER")
                    .font(.headline)
                    .fontWeight(.bold)

                Text("BILL DUE-DATE HEAT MAP")
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(Color(red: 0.49, green: 0.83, blue: 1.00))

                Text(watchSync.billCalendarMonthLabel ?? "NA")
                    .font(.system(size: 13, weight: .bold))

                if watchSync.billCalendarMonthLabel != nil {
                    urgencyLegend

                    LazyVGrid(columns: columns, spacing: 2) {
                        ForEach(Array(weekdays.enumerated()), id: \.offset) { _, weekday in
                            Text(weekday)
                                .font(.system(size: 7, weight: .bold))
                                .foregroundStyle(.secondary)
                        }

                        if calendarCellCount > 0 {
                            ForEach(0..<calendarCellCount, id: \.self) { index in
                                calendarCell(at: index)
                            }
                        }
                    }

                    if watchSync.billCalendarDays.allSatisfy({ $0.billCount == 0 }) {
                        Text("No bill due dates this month")
                            .font(.system(size: 8))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.horizontal, 5)
            .padding(.bottom, 8)
        }
        .navigationTitle("Bills")
    }

    private var calendarCellCount: Int {
        watchSync.billCalendarFirstWeekday + watchSync.billCalendarDayCount
    }

    private var urgencyLegend: some View {
        HStack(spacing: 7) {
            legendItem(color: urgencyColor("green"), label: "10+")
            legendItem(color: urgencyColor("amber"), label: "3-9")
            legendItem(color: urgencyColor("red"), label: "0-2")
        }
    }

    @ViewBuilder
    private func calendarCell(at index: Int) -> some View {
        let day = index - watchSync.billCalendarFirstWeekday + 1

        if day < 1 || day > watchSync.billCalendarDayCount {
            Color.clear
                .frame(height: 22)
        } else {
            let calendarDay = watchSync.billCalendarDays.first { $0.day == day }
            let color = urgencyColor(calendarDay?.urgency)

            ZStack(alignment: .bottomTrailing) {
                RoundedRectangle(cornerRadius: 3)
                    .fill(
                        calendarDay?.billCount ?? 0 > 0
                            ? color.opacity(0.82)
                            : Color.white.opacity(0.08)
                    )

                RoundedRectangle(cornerRadius: 3)
                    .stroke(
                        calendarDay?.isToday == true ? Color.white : Color.clear,
                        lineWidth: 1.3
                    )

                Text(String(day))
                    .font(.system(size: 8, weight: .semibold))
                    .frame(maxWidth: .infinity, maxHeight: .infinity)

                if let billCount = calendarDay?.billCount, billCount > 1 {
                    Text(String(billCount))
                        .font(.system(size: 6, weight: .bold))
                        .padding(2)
                }
            }
            .frame(height: 22)
            .accessibilityLabel(dayAccessibilityLabel(calendarDay, day: day))
        }
    }

    private func legendItem(color: Color, label: String) -> some View {
        HStack(spacing: 2) {
            RoundedRectangle(cornerRadius: 1)
                .fill(color)
                .frame(width: 5, height: 5)

            Text(label)
                .font(.system(size: 7))
        }
    }

    private func urgencyColor(_ urgency: String?) -> Color {
        switch urgency {
        case "green":
            return Color(red: 0.13, green: 0.77, blue: 0.37)
        case "amber":
            return Color(red: 0.96, green: 0.62, blue: 0.04)
        case "red":
            return Color(red: 0.94, green: 0.27, blue: 0.27)
        default:
            return Color.clear
        }
    }

    private func dayAccessibilityLabel(
        _ calendarDay: WatchBillCalendarDay?,
        day: Int
    ) -> String {
        guard let calendarDay, calendarDay.billCount > 0 else {
            return "Day \(day), no bills due"
        }

        let billLabel = calendarDay.billCount == 1 ? "bill" : "bills"
        return "Day \(day), \(calendarDay.billCount) \(billLabel) due"
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
                        filscore: watchSync.creditFilscore,
                        lineWidth: 9,
                        trackColor: Color(red: 0.231, green: 0.510, blue: 0.965),
                        gradient: creditGradient
                    )
                    .frame(width: 156, height: 156)

                    CreditHealthConcentricRing(
                        filscore: watchSync.creditBureauFilscore,
                        lineWidth: 9,
                        trackColor: Color(red: 0.078, green: 0.722, blue: 0.651),
                        gradient: creditBureauGradient
                    )
                    .frame(width: 130, height: 130)

                    CreditHealthConcentricRing(
                        filscore: watchSync.nonStarterFilscore,
                        lineWidth: 9,
                        trackColor: Color(red: 0.937, green: 0.267, blue: 0.267),
                        gradient: nonStarterGradient
                    )
                    .frame(width: 104, height: 104)

                    CreditHealthConcentricRing(
                        filscore: watchSync.socialFilscore,
                        lineWidth: 9,
                        trackColor: Color(red: 0.980, green: 0.800, blue: 0.082),
                        gradient: socialGradient
                    )
                    .frame(width: 78, height: 78)

                    CreditHealthConcentricRing(
                        filscore: watchSync.psychometricFilscore,
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
                    value: scoreText(
                        watchSync.creditFilscore
                    )
                )

                WatchMetricRow(
                    title: "Credit Bureau",
                    value: scoreText(
                        watchSync.creditBureauFilscore
                    )
                )

                WatchMetricRow(
                    title: "Behaviour",
                    value: scoreText(
                        watchSync.psychometricFilscore
                    )
                )


                WatchMetricRow(
                    title: "Social",
                    value: scoreText(
                        watchSync.socialFilscore
                    )
                )


                WatchMetricRow(
                    title: "Non-Starter",
                    value: scoreText(
                        watchSync.nonStarterFilscore
                    )
                )


                Divider()


                Text("Credit Health Trend")
                    .font(.caption)
                    .fontWeight(.semibold)

                WatchTrendGraph(
                    values: watchSync.creditHealthTrend,
                    maximum: 1000
                )
            }
            .padding()
        }
        .navigationTitle("Credit")
    }

    private func scoreText(
        _ value: Double?
    ) -> String {

        guard let value else {
            return "NA"
        }

        return String(
            format: "%.0f",
            value
        )
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
                        watchSync.wealthBuilding,
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
            return "NA"
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
            return "NA"
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
                        watchSync.financialHealth,
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
                    } ?? "NA"
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
    let progress: Double?
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

            if let progress, progress > 0 {
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
    let filscore: Double?
    let lineWidth: CGFloat
    let trackColor: Color
    let gradient: LinearGradient

    private var progress: Double {
        guard let filscore else { return 0 }
        return min(max(filscore / 1000, 0), 1)
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

