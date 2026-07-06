# Public Page Deployment Checklist

Use this checklist before entering the final Support, Privacy Policy, and Terms
URLs into Google Play Console or App Store Connect.

## Target Public URLs

- Support:
  `https://your-public-domain.example/support`
- Privacy:
  `https://your-public-domain.example/privacy`
- Terms:
  `https://your-public-domain.example/terms`

## Matching In-App Routes

- Support route:
  `/support`
- Privacy route:
  `/privacy`
- Terms route:
  `/terms`

## Deployment Checklist

- [ ] Public domain is live and uses HTTPS
- [ ] `/support` loads successfully without authentication
- [ ] `/privacy` loads successfully without authentication
- [ ] `/terms` loads successfully without authentication
- [ ] Page titles and content match the store metadata drafts
- [ ] Contact email on the support page is monitored
- [ ] Privacy page matches the final store disclosure answers
- [ ] Terms page reflects the intended production legal language
- [ ] Mobile browser rendering is verified on iPhone and Android
- [ ] Desktop browser rendering is verified

## Suggested Validation Commands

- Open the deployed URLs in a browser and confirm HTTP 200 responses.
- Capture screenshots of the final public pages for submission evidence.
- Confirm the same URLs are inserted into:
  - `frontend/store-metadata.template.json`
  - Play Console store listing
  - App Store Connect app information

## Evidence To Save

- screenshot of each live page
- date/time validated
- person who validated
- domain used for submission

## Notes

Implementing the in-app routes is not enough by itself. Store submission needs
public, stable URLs that reviewers and users can access outside the app.
