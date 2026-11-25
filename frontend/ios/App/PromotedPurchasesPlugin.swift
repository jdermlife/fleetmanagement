import Capacitor
import Foundation
import StoreKit

@objc(PromotedPurchasesPlugin)
public class PromotedPurchasesPlugin: CAPPlugin, CAPBridgedPlugin, SKPaymentQueueDelegate {
    public let identifier = "PromotedPurchasesPlugin"
    public let jsName = "PromotedPurchases"
    public let pluginMethods: [CAPPluginMethod] = []

    private var purchaseIntentTask: Task<Void, Never>?

    override public func load() {
        super.load()

        if #available(iOS 16.4, *) {
            startPurchaseIntentListener()
        } else {
            SKPaymentQueue.default().delegate = self
        }
    }

    deinit {
        purchaseIntentTask?.cancel()
        purchaseIntentTask = nil

        if #unavailable(iOS 16.4), SKPaymentQueue.default().delegate === self {
            SKPaymentQueue.default().delegate = nil
        }
    }

    @available(iOS 16.4, *)
    private func startPurchaseIntentListener() {
        purchaseIntentTask?.cancel()
        purchaseIntentTask = Task.detached { [weak self] in
            for await intent in PurchaseIntent.intents {
                guard !Task.isCancelled else {
                    break
                }
                self?.emitPurchaseIntent(productIdentifier: intent.product.id)
            }
        }
    }

    public func paymentQueue(
        _ queue: SKPaymentQueue,
        shouldAddStorePayment payment: SKPayment,
        for product: SKProduct
    ) -> Bool {
        emitPurchaseIntent(productIdentifier: product.productIdentifier)
        return false
    }

    private func emitPurchaseIntent(productIdentifier: String) {
        DispatchQueue.main.async { [weak self] in
            self?.notifyListeners(
                "purchaseIntentReceived",
                data: ["productIdentifier": productIdentifier],
                retainUntilConsumed: true
            )
        }
    }
}
