// Small hand-drawn (not AI-generated) flat-style SVG illustrations used to
// approximate the reference dashboard mockup's artwork -- a package+pin for
// the next-action card, a delivery rider for the Lalamove card, and a
// storefront for the "grow your business" CTA. Pure vector + currentColor
// accents so they stay crisp and theme-aware without a raster asset.

export function PackageDeliveryArt({ className = '' }) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
      <circle cx="80" cy="64" r="52" fill="currentColor" opacity=".08" />
      <g transform="translate(28,38)">
        <rect x="0" y="14" width="66" height="46" rx="6" fill="#0D5135" />
        <rect x="0" y="14" width="66" height="14" rx="6" fill="#16794B" />
        <path d="M0 20h66" stroke="#0A3D28" strokeWidth="1.5" />
        <path d="M33 14v46" stroke="#0A3D28" strokeWidth="1.5" />
        <path d="M18 14 33 28 48 14" stroke="#ECF8EF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
      <g transform="translate(90,10)">
        <path d="M18 0C8 0 0 8 0 18c0 13 18 30 18 30s18-17 18-30C36 8 28 0 18 0Z" fill="#F2A93B" />
        <circle cx="18" cy="18" r="8" fill="#FFF6E5" />
        <path d="M14.5 18l2.4 2.6L22 15" stroke="#D98E1F" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </g>
    </svg>
  )
}

export function DeliveryRiderArt({ className = '' }) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
      <circle cx="82" cy="60" r="54" fill="currentColor" opacity=".07" />
      <path d="M14 92h132" stroke="currentColor" strokeOpacity=".15" strokeWidth="3" strokeLinecap="round" />
      <g transform="translate(28,34)">
        <circle cx="16" cy="52" r="14" fill="none" stroke="#16794B" strokeWidth="5" />
        <circle cx="88" cy="52" r="14" fill="none" stroke="#16794B" strokeWidth="5" />
        <path d="M16 52h26l14-24h20" stroke="#0D5135" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M56 52h32l10-8" stroke="#0D5135" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <rect x="60" y="4" width="26" height="20" rx="5" fill="#F2A93B" />
        <circle cx="78" cy="16" r="7" fill="#FFF6E5" />
        <circle cx="78" cy="16" r="3" fill="#0D5135" />
        <path d="M2 30q10-8 20 0" stroke="currentColor" strokeOpacity=".3" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M-4 40q10-7 20 0" stroke="currentColor" strokeOpacity=".2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </g>
    </svg>
  )
}

export function StorefrontArt({ className = '' }) {
  return (
    <svg viewBox="0 0 160 120" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" role="presentation">
      <circle cx="80" cy="62" r="50" fill="currentColor" opacity=".08" />
      <g transform="translate(34,28)">
        <rect x="0" y="18" width="92" height="46" rx="4" fill="#0D5135" />
        <path d="M-6 18 6 0h80l12 18Z" fill="#F2A93B" />
        <path d="M-6 18h104" stroke="#A96713" strokeWidth="2" />
        {[0, 1, 2, 3, 4].map((i) => <rect key={i} x={-4 + i * 20.8} y="0" width="10.4" height="18" fill={i % 2 === 0 ? '#ECF8EF' : '#F2A93B'} opacity={i % 2 === 0 ? 0.9 : 1} />)}
        <rect x="10" y="30" width="24" height="34" rx="2" fill="#ECF8EF" opacity=".9" />
        <rect x="14" y="34" width="16" height="14" rx="1" fill="#16794B" opacity=".5" />
        <rect x="54" y="30" width="28" height="34" rx="2" fill="#16794B" />
        <rect x="61" y="44" width="14" height="20" rx="1.5" fill="#ECF8EF" />
      </g>
    </svg>
  )
}
