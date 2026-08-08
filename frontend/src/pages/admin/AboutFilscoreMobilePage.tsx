export const ABOUT_FILSCORE_MOBILE_CONTENT = `FILSCORE is a financial intelligence platform designed to help people understand, organize, and strengthen their financial lives. The Apple and Android applications bring the platform's guided tools into a convenient mobile experience, allowing authorized users to review financial information, complete profile details, monitor progress, and access relevant workflows from supported phones and tablets. The mobile editions are intended to complement the secure web platform while preserving a consistent experience across devices.

The application focuses on practical financial awareness. Users can build or update a financial profile, review a Financial Health Dashboard, work through budgeting and debt management activities, and examine Credit Health and Wealth Building results when their subscription permits access. Information is presented in structured sections so users can move through complex financial topics in manageable steps. Mobile navigation is optimized for repeated use, making it easier to return to unfinished tasks or review updated information.

FILSCORE for Apple and Android also supports intelligent assistance. AI-enabled features may help explain visible page content, guide users toward appropriate sections, summarize permitted information, and answer general questions about available workflows. These features are designed as decision-support tools rather than replacements for professional financial, legal, accounting, or investment advice. Users remain responsible for reviewing their information, confirming accuracy, and making decisions appropriate to their circumstances.

Privacy and security are central to the mobile experience. Access requires an authenticated account, and protected pages are limited according to assigned roles and permissions. The platform uses controlled sessions, secure communication with backend services, and account safeguards intended to reduce unauthorized access. Users should protect passwords, verification codes, and devices, and should sign out when using a shared phone or tablet. Sensitive information should only be entered into fields specifically provided for that purpose.

The Apple version is prepared for use within Apple's mobile ecosystem and follows the same core FILSCORE workflows available through supported channels. Depending on configuration, users may sign in using approved authentication methods, receive platform-appropriate permission prompts, and interact with features through responsive controls suited to iPhone or iPad screens. Availability of particular capabilities can depend on the device, operating-system version, account role, subscription, regional rules, and enabled services.

The Android version delivers the corresponding FILSCORE experience for compatible Android phones and tablets. It is designed to work with standard Android navigation, security, and permission behavior. Device capabilities such as microphone access may be requested only when a user opens a feature that needs them. FILSCORE does not require an advertising identifier for its core financial functions. Permissions should remain limited to capabilities necessary for the selected workflow and current release.

Both mobile editions communicate with FILSCORE services to retrieve and save authorized account information. A reliable internet connection may therefore be required for sign-in, synchronization, AI assistance, document processing, score retrieval, and other server-supported actions. Temporary network interruption can delay updates or prevent a workflow from completing. Users should confirm that important changes have been saved before closing the application or moving between devices.

FILSCORE aims to provide a clear, inclusive, and responsible experience across Apple and Android. Interface wording, controls, and layouts may evolve as accessibility, security, regulatory, and usability requirements change. Features can also differ between releases while platform reviews or staged deployments are underway. Official release notes and in-application notices should be consulted for current availability, limitations, and material changes.

It does not expose proprietary scoring formulas, internal model parameters, or private customer records. Instead, it explains the purpose and boundaries of the mobile applications. Administrators should ensure that published descriptions, privacy disclosures, permission declarations, screenshots, and support guidance remain consistent with the behavior of each released build.`

export default function AboutFilscoreMobilePage() {
  const paragraphs = ABOUT_FILSCORE_MOBILE_CONTENT.split('\n\n')

  return (
    <main className="standalone-card auth-screen">
      <h1>About FILSCORE for Apple and Android</h1>
      <div className="stack-panel">
        <section className="card auth-helper-card">
          {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      </div>
    </main>
  )
}
