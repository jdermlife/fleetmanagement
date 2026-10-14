import SwiftUI

@main
struct FINANCIAL_HEALTH_Watch_WatchApp: App {

    init() {
        print("[WatchApp] Build marker: NA-guard-v2")
        WatchSyncReceiver.shared.start()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
