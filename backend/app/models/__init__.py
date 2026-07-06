# from app.models.loan_application import LoanApplication

from app.models.audit_log import AuditLog  # noqa: F401
from app.models.vehicles import Vehicle  # noqa: F401
from app.models.fuel_logs import FuelLog  # noqa: F401
from app.models.maintenance_logs import MaintenanceRecord  # noqa: F401
from app.models.insurance_records import InsuranceRecord  # noqa: F401
from app.models.gps_tracking import GpsTrackingRecord  # noqa: F401

from app.models.ai_governance import (  # noqa: F401
    AIRequest,
    AIResponse,
    AIFeedback,
)

from app.models.document import (  # noqa: F401
    Document,
    DocumentVersion,
    DocumentTag,
    DocumentSignature,
    DocumentType,
    DocumentStatus,
    EntityType,
)

from app.models.notification import (  # noqa: F401
    Notification,
    NotificationTemplate,
    NotificationPreference,
    NotificationDeliveryAttempt,
    NotificationDeadLetter,
    NotificationChannel,
    NotificationStatus,
    NotificationPriority,
)

from app.models.users import User, AuthSession, MfaBackupCode  # noqa: F401
from app.models.roles import Role, Permission  # noqa: F401
from app.models.subscription import (  # noqa: F401
    Feature,
    PaymentProvider,
    PaymentWebhook,
    PlanFeature,
    Subscription,
    SubscriptionEvent,
    SubscriptionInvoice,
    SubscriptionPayment,
    SubscriptionPlan,
    SubscriptionRecordUsageEvent,
    SubscriptionUsage,
)
