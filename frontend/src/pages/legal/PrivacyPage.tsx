const privacySections = [
  {
    title: '1. Introduction',
    paragraphs: [
      'This Privacy Policy applies to the FILSCORE app (hereby referred to as “Application”) for mobile devices created by the Service Provider as a free service. The Application is provided “AS IS.”',
    ],
  },
  {
    title: '2. Information Collection and Use',
    paragraphs: ['The Application collects information when you download and use it. This may include:'],
    bullets: [
      'The information you provide for the application to deliver the services you are availing and your device’s Internet Protocol (IP) address',
      'The pages of the Application that you visit, including the time and date of visit',
      'The time spent on the Application and its pages',
      'The operating system used on your mobile device',
      'The Application does not gather precise location information but may collect approximate location data to enhance user experience.',
    ],
  },
  {
    title: '3. Use of Location Data',
    paragraphs: ['Location data helps the Service Provider deliver features such as:'],
    bullets: [
      'Personalized content and recommendations',
      'Location-based services',
      'Analytics and improvements through aggregated, anonymized data',
      'Optimization via third-party services that receive anonymized location data',
    ],
  },
  {
    title: '4. Use of Information',
    paragraphs: ['The Service Provider may use the information you provide to:'],
    bullets: [
      'Contact you with important updates, notices, and marketing promotions',
      'Improve the Application’s performance and functionality',
      'Enhance user experience through analytics and recommendations',
    ],
  },
  {
    title: '5. Third-Party Access',
    paragraphs: [
      'Only aggregated, anonymized data is periodically transmitted to external services to aid in improving the Application and its service. The Service Provider may share information with third parties as described in this Privacy Policy.',
      'The Service Provider may disclose User Provided and Automatically Collected Information:',
    ],
    bullets: [
      'As required by law (e.g., subpoena or similar legal process)',
      'When disclosure is necessary to protect rights, safety, or investigate fraud',
      'With trusted service providers who adhere to this Privacy Policy',
    ],
  },
  {
    title: '6. Opt-Out Rights',
    paragraphs: [
      'You may stop all data collection by uninstalling the Application using standard uninstall processes available on your device or app marketplace.',
    ],
  },
  {
    title: '7. Data Retention Policy',
    paragraphs: [
      'The Service Provider retains User Provided data for as long as you use the Application and for a reasonable time thereafter.',
      'To request deletion of your data, contact admin@quantech.international. The Service Provider will respond within a reasonable time.',
    ],
  },
  {
    title: '8. Children’s Privacy',
    paragraphs: [
      'The Application is not intended for children under 13 years of age.',
      'The Service Provider does not knowingly collect personally identifiable information from children.',
      'Parents and guardians are encouraged to monitor their children’s internet usage and instruct them not to provide personal information through the Application.',
      'If you believe a child has provided such information, contact admin@quantech.international for assistance.',
    ],
  },
  {
    title: '9. Security',
    paragraphs: [
      'The Service Provider safeguards your information using physical, electronic, and procedural measures to protect confidentiality and integrity.',
    ],
  },
  {
    title: '10. Changes',
    paragraphs: [
      'This Privacy Policy may be updated periodically. Continued use of the Application after updates constitutes acceptance of the revised policy.',
    ],
  },
  {
    title: '11. Your Consent',
    paragraphs: [
      'By using the Application, you consent to the processing of your information as described in this Privacy Policy and any future amendments.',
    ],
  },
  {
    title: '12. Contact Us',
    paragraphs: [
      'For privacy-related inquiries or questions about data practices, please contact:',
    ],
  },
] as const

export default function PrivacyPage() {
  return (
    <div className="standalone-card auth-screen">
      <h1>Privacy Disclosures</h1>
      <p className="intro">
        Effective Date: June, 2026
        <br />
        Application: FILSCORE
        <br />
        Service Provider: Quantech.International Solutions OPC
        <br />
        Contact Email:{' '}
        <a href="mailto:admin@quantech.international">admin@quantech.international</a>
      </p>

      <div className="stack-panel">
        {privacySections.map((section) => (
          <section key={section.title} className="card auth-helper-card">
            <h3>{section.title}</h3>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {'bullets' in section && section.bullets ? (
              <ul>
                {section.bullets.map((bullet) => (
                  <li key={bullet}>{bullet}</li>
                ))}
              </ul>
            ) : null}
            {section.title === '12. Contact Us' ? (
              <p>
                <a href="mailto:admin@quantech.international">admin@quantech.international</a>
              </p>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  )
}
