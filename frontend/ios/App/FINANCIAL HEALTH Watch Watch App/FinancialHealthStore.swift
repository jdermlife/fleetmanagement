import Foundation
import Combine

final class FinancialHealthStore: ObservableObject {

    @Published var data: FinancialHealthData

    init(data: FinancialHealthData = .preview) {
        self.data = data
    }

    func refresh() async {
        // API connection will be added later.
        // For now, retain the preview data.
    }
}
