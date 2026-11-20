export function BreweryLogo({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Shield crest */}
      <path
        d="M24 3L41 9.5V23.5C41 33.8 33.6 41.4 24 45C14.4 41.4 7 33.8 7 23.5V9.5L24 3Z"
        fill="#111827"
        stroke="#475569"
        strokeWidth="1.75"
      />
      <path
        d="M24 6.5L37.5 11.8V23.2C37.5 31.6 31.5 37.9 24 41.1C16.5 37.9 10.5 31.6 10.5 23.2V11.8L24 6.5Z"
        stroke="#f43f5e"
        strokeOpacity="0.65"
        strokeWidth="1.25"
      />
      {/* Geometric Badger Stripes / Hop Silhouette */}
      <path
        d="M24 12L31 19.5L27.5 23L32 28L24 35.5L16 28L20.5 23L17 19.5L24 12Z"
        fill="#f8fafc"
        fillOpacity="0.92"
      />
      {/* Central badger stripe */}
      <path
        d="M24 12V35.5"
        stroke="#0f172a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M19.5 18.5L24 23L28.5 18.5"
        stroke="#f43f5e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
