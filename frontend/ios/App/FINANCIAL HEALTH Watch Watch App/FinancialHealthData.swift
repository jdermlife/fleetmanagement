import Foundation

struct FinancialHealthData {
    let financialHealthScore: Int
    let filscore: Int
    let wealthCapacityScore: Int

    let netWorth: Double
    let budgetStatus: String

    static let preview = FinancialHealthData(
        financialHealthScore: 82,
        filscore: 745,
        wealthCapacityScore: 76,
        netWorth: 2_450_000,
        budgetStatus: "On Track"
    )
}
