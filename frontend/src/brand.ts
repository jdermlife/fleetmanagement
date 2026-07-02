export const APP_NAME = 'FILSCORE'
export const APP_TAGLINE = 'Borrow Smart. Lend Right.'

const brandLogoSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="FILSCORE logo">
  <defs>
    <linearGradient id="fsGold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff2b3" />
      <stop offset="35%" stop-color="#ffd766" />
      <stop offset="70%" stop-color="#d39a25" />
      <stop offset="100%" stop-color="#8f5d10" />
    </linearGradient>
    <linearGradient id="fsBlue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#5ea4ff" />
      <stop offset="55%" stop-color="#143d9a" />
      <stop offset="100%" stop-color="#061c5d" />
    </linearGradient>
    <linearGradient id="fsRed" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4b4b" />
      <stop offset="55%" stop-color="#d10707" />
      <stop offset="100%" stop-color="#7d0000" />
    </linearGradient>
    <linearGradient id="fsSilver" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f7f7fb" />
      <stop offset="50%" stop-color="#d0d3dd" />
      <stop offset="100%" stop-color="#9398a8" />
    </linearGradient>
    <linearGradient id="fsInner" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#17212b" />
      <stop offset="100%" stop-color="#061f74" />
    </linearGradient>
    <linearGradient id="fsAccent" x1="0%" y1="100%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0b4dff" />
      <stop offset="100%" stop-color="#25d6ff" />
    </linearGradient>
    <filter id="fsShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#001238" flood-opacity="0.18" />
    </filter>
  </defs>

  <g filter="url(#fsShadow)">
    <circle cx="160" cy="160" r="100" fill="#ffffff" stroke="url(#fsGold)" stroke-width="12" />
    <circle cx="160" cy="160" r="82" fill="none" stroke="#0a2c8f" stroke-width="18" />

    <path
      d="M58 108 A132 132 0 0 1 281 109"
      fill="none"
      stroke="url(#fsBlue)"
      stroke-width="42"
      stroke-linecap="butt"
    />
    <path
      d="M266 215 A132 132 0 0 1 85 283"
      fill="none"
      stroke="url(#fsRed)"
      stroke-width="42"
      stroke-linecap="butt"
    />
    <path
      d="M49 112 A132 132 0 0 0 60 269"
      fill="none"
      stroke="url(#fsSilver)"
      stroke-width="42"
      stroke-linecap="butt"
    />

    <path
      d="M58 108 A132 132 0 0 1 281 109"
      fill="none"
      stroke="url(#fsGold)"
      stroke-width="8"
      stroke-linecap="butt"
    />
    <path
      d="M266 215 A132 132 0 0 1 85 283"
      fill="none"
      stroke="url(#fsGold)"
      stroke-width="8"
      stroke-linecap="butt"
    />
    <path
      d="M49 112 A132 132 0 0 0 60 269"
      fill="none"
      stroke="url(#fsGold)"
      stroke-width="8"
      stroke-linecap="butt"
    />

    <path
      d="M111 122 H191 L183 140 H139 V170 H177 V188 H139 V232 H111 Z"
      fill="url(#fsInner)"
      stroke="url(#fsGold)"
      stroke-width="3"
    />
    <path
      d="M207 121 H254 L243 139 H213 C199 139 193 146 193 152 C193 159 199 166 213 166 H229 C252 166 266 181 266 200 C266 221 249 236 223 236 H177 L188 218 H221 C236 218 242 212 242 204 C242 197 235 190 221 190 H205 C182 190 169 175 169 156 C169 136 186 121 207 121 Z"
      fill="url(#fsAccent)"
      stroke="url(#fsGold)"
      stroke-width="3"
    />
  </g>
</svg>
`.trim()

export const brandLogoDataUri = `data:image/svg+xml;utf8,${encodeURIComponent(brandLogoSvg)}`
