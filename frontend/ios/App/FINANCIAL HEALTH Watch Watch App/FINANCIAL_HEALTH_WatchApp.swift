import SwiftUI

@main
struct FINANCIAL_HEALTH_Watch_WatchApp: App {

    init() {
        WatchSyncReceiver.shared.start()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
