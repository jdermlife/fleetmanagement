/// <reference types="vite/client" />

declare interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_APPLE_CLIENT_ID?: string
  readonly VITE_APPLE_REDIRECT_URI?: string
  readonly VITE_PAYMENT_DEFAULT_CHANNEL?: string
  readonly VITE_PAYMENT_BANK_ACCOUNT_NAME?: string
  readonly VITE_PAYMENT_BANK_ACCOUNT_NO?: string
  readonly VITE_PAYMENT_BANK_NAME?: string
  readonly VITE_PAYMENT_GCASH_NUMBER?: string
  readonly VITE_PAYMENT_GCASH_NAME?: string
  readonly VITE_PAYMENT_MAYA_NUMBER?: string
  readonly VITE_PAYMENT_MAYA_NAME?: string
  readonly VITE_PAYMENT_SUPPORT_EMAIL?: string
}

declare interface ImportMeta {
  readonly env: ImportMetaEnv
}
