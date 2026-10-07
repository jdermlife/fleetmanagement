import Foundation
import Capacitor
import WatchConnectivity

@objc(WatchSyncPlugin)
public class WatchSyncPlugin: CAPPlugin, CAPBridgedPlugin {

    public let identifier = "WatchSyncPlugin"
    public let jsName = "WatchSync"

    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(
            name: "updateSnapshot",
            returnType: CAPPluginReturnPromise
        )
    ]

    private let appGroup =
        "group.com.quantech.filscore"

    private let snapshotKey =
        "watch.financialHealth.snapshot"

    override public func load() {
        super.load()

        if WCSession.isSupported() {

            WCSession.default.delegate =
                WatchSyncSessionDelegate.shared

            WCSession.default.activate()
        }
    }


    // MARK: - Update Watch Snapshot

    @objc func updateSnapshot(
        _ call: CAPPluginCall
    ) {

        guard let snapshot =
            call.getObject("snapshot")
        else {

            call.reject("Missing snapshot")
            return
        }


        // ---------------------------------------------------------
        // Save the complete snapshot locally.
        // This preserves the full JSON, including optional values.
        // ---------------------------------------------------------

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

        } catch {

            call.reject(
                "Unable to save Watch snapshot: \(error.localizedDescription)"
            )

            return
        }


        // ---------------------------------------------------------
        // WatchConnectivity does NOT accept NSNull / JavaScript null.
        //
        // Remove unsupported values before sending the snapshot.
        // ---------------------------------------------------------

        guard let cleanSnapshot =
            sanitizeForWatchConnectivity(snapshot)
            as? [String: Any]
        else {

            call.reject(
                "Unable to prepare Watch snapshot"
            )

            return
        }


        guard WCSession.isSupported() else {

            call.resolve([
                "saved": true,
                "sent": false
            ])

            return
        }


        let session = WCSession.default


        guard session.activationState == .activated else {

            call.resolve([
                "saved": true,
                "sent": false
            ])

            return
        }


        // ---------------------------------------------------------
        // Reliable background delivery
        // ---------------------------------------------------------

        session.transferUserInfo([
            "type": "financialHealthSnapshot",
            "snapshot": cleanSnapshot
        ])


        // ---------------------------------------------------------
        // Immediate delivery when Watch is reachable
        // ---------------------------------------------------------

        if session.isReachable {

            session.sendMessage(
                [
                    "type": "financialHealthSnapshot",
                    "snapshot": cleanSnapshot
                ],
                replyHandler: nil,
                errorHandler: { error in

                    print(
                        "[WatchSyncPlugin] sendMessage error: \(error.localizedDescription)"
                    )
                }
            )

        }


        call.resolve([
            "saved": true,
            "sent": true
        ])
    }


    // MARK: - WatchConnectivity Sanitizer

    private func sanitizeForWatchConnectivity(
        _ value: Any
    ) -> Any? {

        // ---------------------------------------------------------
        // Remove null values.
        // ---------------------------------------------------------

        if value is NSNull {
            return nil
        }


        // ---------------------------------------------------------
        // Dictionaries
        // ---------------------------------------------------------

        if let dictionary =
            value as? [String: Any] {

            var cleanDictionary =
                [String: Any]()

            for (key, value) in dictionary {

                if let cleanValue =
                    sanitizeForWatchConnectivity(value) {

                    cleanDictionary[key] =
                        cleanValue
                }
            }

            return cleanDictionary
        }


        // ---------------------------------------------------------
        // Arrays
        // ---------------------------------------------------------

        if let array =
            value as? [Any] {

            return array.compactMap {
                sanitizeForWatchConnectivity($0)
            }
        }


        // ---------------------------------------------------------
        // Supported property-list values
        // ---------------------------------------------------------

        if value is String {
            return value
        }

        if value is NSNumber {
            return value
        }

        if value is Date {
            return value
        }

        if value is Data {
            return value
        }


        // ---------------------------------------------------------
        // Unsupported type
        // ---------------------------------------------------------

        print(
            "[WatchSyncPlugin] Removing unsupported value type: \(type(of: value))"
        )

        return nil
    }
}


// MARK: - Watch Session Delegate

final class WatchSyncSessionDelegate:
    NSObject,
    WCSessionDelegate {

    static let shared =
        WatchSyncSessionDelegate()

    private override init() {
        super.init()
    }


    func session(
        _ session: WCSession,
        activationDidCompleteWith activationState:
            WCSessionActivationState,
        error: Error?
    ) {

        if let error {

            print(
                "[WatchSyncPlugin] WatchConnectivity activation error: \(error.localizedDescription)"
            )

            return
        }

        print(
            "[WatchSyncPlugin] WatchConnectivity activated: \(activationState.rawValue)"
        )
    }


    func sessionDidBecomeInactive(
        _ session: WCSession
    ) {

        print(
            "[WatchSyncPlugin] Watch session became inactive"
        )
    }


    func sessionDidDeactivate(
        _ session: WCSession
    ) {

        print(
            "[WatchSyncPlugin] Watch session deactivated"
        )

        session.activate()
    }
}
