import Foundation
import Combine
import WatchConnectivity

final class WatchSyncReceiver: NSObject, ObservableObject, WCSessionDelegate {

    static let shared = WatchSyncReceiver()

    // MARK: - Main Scores

    @Published private(set) var financialHealth: Double?
    @Published private(set) var wealthBuilding: Double?

    // MARK: - Credit Health

    @Published private(set) var creditScore: Double?
    @Published private(set) var psychometricScore: Double?
    @Published private(set) var socialScore: Double?
    @Published private(set) var nonStarterScore: Double?

    // MARK: - Budget

    @Published private(set) var budgetScore: Double?
    @Published private(set) var monthlyIncome: Double?
    @Published private(set) var monthlyExpenses: Double?
    @Published private(set) var monthlyCashFlow: Double?

    // MARK: - Net Worth

    @Published private(set) var netWorth: Double?
    @Published private(set) var projectedNetWorth: Double?

    // MARK: - Wealth Components

    @Published private(set) var liquidityBuffer: Double?
    @Published private(set) var cashFlowStrength: Double?
    @Published private(set) var leverageControl: Double?
    @Published private(set) var emergencyReadiness: Double?
    @Published private(set) var investmentReadiness: Double?
    @Published private(set) var retirementReadiness: Double?
    @Published private(set) var financialIndependence: Double?
    @Published private(set) var goalMomentum: Double?
    @Published private(set) var protectionCoverage: Double?

    // MARK: - Update / Trends

    @Published private(set) var lastUpdated: Date?

    @Published private(set) var financialHealthTrend: [Double] = []
    @Published private(set) var creditHealthTrend: [Double] = []
    @Published private(set) var wealthBuildingTrend: [Double] = []
    @Published private(set) var budgetTrend: [Double] = []

    // MARK: - Storage

    private let appGroup =
        "group.com.quantech.filscore"

    private let snapshotKey =
        "watch.financialHealth.snapshot"

    private override init() {
        super.init()
    }

    // MARK: - Start

    func start() {

        guard WCSession.isSupported() else {

            print(
                "[WatchSyncReceiver] WatchConnectivity is not supported"
            )

            return
        }

        let session = WCSession.default

        session.delegate = self
        session.activate()

        loadSavedSnapshot()

        print(
            "[WatchSyncReceiver] Activating WatchConnectivity"
        )
    }

    // MARK: - WatchConnectivity Activation

    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState:
            WCSessionActivationState,
        error: Error?
    ) {

        if let error {

            print(
                "[WatchSyncReceiver] Activation error: \(error)"
            )

            return
        }

        print(
            "[WatchSyncReceiver] Activation completed: \(activationState.rawValue)"
        )

        loadSavedSnapshot()
    }

    // MARK: - Receive User Info

    func session(
        _ session: WCSession,
        didReceiveUserInfo userInfo: [String: Any] = [:]
    ) {

        print(
            "[WatchSyncReceiver] Received userInfo"
        )

        handleSnapshot(userInfo)
    }

    // MARK: - Receive Message

    func session(
        _ session: WCSession,
        didReceiveMessage message: [String: Any]
    ) {

        print(
            "[WatchSyncReceiver] Received message"
        )

        handleSnapshot(message)
    }

    // MARK: - Receive Application Context

    func session(
        _ session: WCSession,
        didReceiveApplicationContext applicationContext:
            [String: Any]
    ) {

        print(
            "[WatchSyncReceiver] Received application context"
        )

        handleSnapshot(applicationContext)
    }

    // MARK: - Load Saved Snapshot

    private func loadSavedSnapshot() {

        guard
            let data =
                UserDefaults(
                    suiteName: appGroup
                )?.data(
                    forKey: snapshotKey
                )
        else {
            return
        }

        do {

            let snapshot =
                try JSONSerialization.jsonObject(
                    with: data,
                    options: []
                ) as? [String: Any]

            if let snapshot {

                applySnapshot(snapshot)
            }

        } catch {

            print(
                "[WatchSyncReceiver] Failed to load saved snapshot: \(error)"
            )
        }
    }

    // MARK: - Handle Snapshot

    private func handleSnapshot(
        _ payload: [String: Any]
    ) {

        guard
            let type =
                payload["type"] as? String
        else {

            print(
                "[WatchSyncReceiver] Missing message type"
            )

            return
        }

        guard
            type == "financialHealthSnapshot"
        else {

            print(
                "[WatchSyncReceiver] Ignoring type: \(type)"
            )

            return
        }

        guard
            let snapshot =
                payload["snapshot"] as? [String: Any]
        else {

            print(
                "[WatchSyncReceiver] Missing snapshot"
            )

            return
        }

        do {

            let data =
                try JSONSerialization.data(
                    withJSONObject: snapshot,
                    options: []
                )

            UserDefaults(
                suiteName: appGroup
            )?.set(
                data,
                forKey: snapshotKey
            )

            applySnapshot(snapshot)

            print(
                "[WatchSyncReceiver] Snapshot received successfully"
            )

        } catch {

            print(
                "[WatchSyncReceiver] Failed to save snapshot: \(error)"
            )
        }
    }

    // MARK: - Apply Snapshot

    private func applySnapshot(
        _ snapshot: [String: Any]
    ) {

        // ---------------------------------------------------------
        // FINANCIAL HEALTH
        // ---------------------------------------------------------

        if let value = number(
            snapshot,
            section: "financialHealth",
            key: "value"
        ) {

            DispatchQueue.main.async {

                self.financialHealth = value
            }

            print(
                "[WatchSyncReceiver] Financial Health: \(value)"
            )
        }


        // ---------------------------------------------------------
        // WEALTH BUILDING
        // ---------------------------------------------------------

        if let value = number(
            snapshot,
            section: "wealthBuilding",
            key: "value"
        ) {

            DispatchQueue.main.async {

                self.wealthBuilding = value
            }

            print(
                "[WatchSyncReceiver] Wealth Building: \(value)"
            )
        }


        // ---------------------------------------------------------
        // TRENDS
        // ---------------------------------------------------------

        let healthTrend =
            numberArray(
                snapshot,
                section: "financialHealth",
                key: "trend"
            )

        let creditTrend =
            numberArray(
                snapshot,
                section: "creditHealth",
                key: "trend"
            )

        let wealthTrend =
            numberArray(
                snapshot,
                section: "wealthBuilding",
                key: "trend"
            )

        let budgetTrendValues =
            numberArray(
                snapshot,
                section: "budget",
                key: "trend"
            )

        DispatchQueue.main.async {

            self.financialHealthTrend =
                healthTrend

            self.creditHealthTrend =
                creditTrend

            self.wealthBuildingTrend =
                wealthTrend

            self.budgetTrend =
                budgetTrendValues
        }


        // ---------------------------------------------------------
        // CREDIT HEALTH
        // ---------------------------------------------------------

        let credit =
            number(
                snapshot,
                section: "creditHealth",
                key: "creditScore"
            )

        let psychometric =
            number(
                snapshot,
                section: "creditHealth",
                key: "psychometricScore"
            )

        let social =
            number(
                snapshot,
                section: "creditHealth",
                key: "socialScore"
            )

        let nonStarter =
            number(
                snapshot,
                section: "creditHealth",
                key: "nonStarterScore"
            )

        DispatchQueue.main.async {

            self.creditScore =
                credit

            self.psychometricScore =
                psychometric

            self.socialScore =
                social

            self.nonStarterScore =
                nonStarter
        }


        // ---------------------------------------------------------
        // BUDGET
        // ---------------------------------------------------------

        let budget =
            number(
                snapshot,
                section: "budget",
                key: "score"
            )

        let income =
            number(
                snapshot,
                section: "budget",
                key: "income"
            )

        let expenses =
            number(
                snapshot,
                section: "budget",
                key: "expenses"
            )

        let cashFlow =
            number(
                snapshot,
                section: "budget",
                key: "net"
            )

        DispatchQueue.main.async {

            self.budgetScore =
                budget

            self.monthlyIncome =
                income

            self.monthlyExpenses =
                expenses

            self.monthlyCashFlow =
                cashFlow
        }


        // ---------------------------------------------------------
        // NET WORTH
        // ---------------------------------------------------------

        let actualNetWorth =
            number(
                snapshot,
                section: "netWorth",
                key: "actual"
            )

        let projectedNetWorthValue =
            number(
                snapshot,
                section: "netWorth",
                key: "projected"
            )

        DispatchQueue.main.async {

            self.netWorth =
                actualNetWorth

            self.projectedNetWorth =
                projectedNetWorthValue
        }


        // ---------------------------------------------------------
        // WEALTH COMPONENTS
        // ---------------------------------------------------------

        let liquidity =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "liquidityBuffer"
            )

        let cashFlowStrengthValue =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "cashFlowStrength"
            )

        let leverage =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "leverageControl"
            )

        let emergency =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "emergencyReadiness"
            )

        let investment =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "investmentReadiness"
            )

        let retirement =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "retirementReadiness"
            )

        let independence =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "financialIndependence"
            )

        let goal =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "goalMomentum"
            )

        let protection =
            number(
                snapshot,
                section: "wealthBuilding",
                key: "protectionCoverage"
            )

        DispatchQueue.main.async {

            self.liquidityBuffer =
                liquidity

            self.cashFlowStrength =
                cashFlowStrengthValue

            self.leverageControl =
                leverage

            self.emergencyReadiness =
                emergency

            self.investmentReadiness =
                investment

            self.retirementReadiness =
                retirement

            self.financialIndependence =
                independence

            self.goalMomentum =
                goal

            self.protectionCoverage =
                protection
        }


        // ---------------------------------------------------------
        // UPDATED AT
        // ---------------------------------------------------------

        if let updatedAt =
            snapshot["updatedAt"] as? String {

            let date =
                ISO8601DateFormatter().date(
                    from: updatedAt
                )

            DispatchQueue.main.async {

                self.lastUpdated = date
            }
        }


        // ---------------------------------------------------------
        // NOTIFICATION
        // ---------------------------------------------------------

        NotificationCenter.default.post(
            name: .financialHealthSnapshotUpdated,
            object: nil
        )
    }

    // MARK: - Number Helper

    private func number(
        _ snapshot: [String: Any],
        section: String,
        key: String
    ) -> Double? {

        guard
            let sectionData =
                snapshot[section] as? [String: Any],
            let value =
                sectionData[key] as? NSNumber
        else {

            return nil
        }

        return value.doubleValue
    }

    // MARK: - Number Array Helper

    private func numberArray(
        _ snapshot: [String: Any],
        section: String,
        key: String
    ) -> [Double] {

        guard
            let sectionData =
                snapshot[section] as? [String: Any],
            let values =
                sectionData[key] as? [Any]
        else {

            return []
        }

        return values.compactMap { value in

            if let number =
                value as? NSNumber {

                return number.doubleValue
            }

            return nil
        }
    }
}


// MARK: - Notification

extension Notification.Name {

    static let financialHealthSnapshotUpdated =
        Notification.Name(
            "financialHealthSnapshotUpdated"
        )
}
