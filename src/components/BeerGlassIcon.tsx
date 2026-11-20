import { srmToHex } from '../services/brewfatherApi';

interface BeerGlassIconProps {
  srm: number | null | undefined;
  className?: string;
}

export function BeerGlassIcon({ srm, className = 'w-6 h-8' }: BeerGlassIconProps) {
  const fill = srmToHex(srm);

  return (
    <svg
      className={className}
      viewBox="0 0 28 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label={srm != null ? `SRM ${srm.toFixed(1)} beer color` : 'Beer glass'}
    >
      {/* Glass body outline */}
      <path
        d="M6.5 4H21.5L19.1 29.2C18.95 30.8 17.6 32 16 32H12C10.4 32 9.05 30.8 8.9 29.2L6.5 4Z"
        fill="#0b1120"
        stroke="#94a3b8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Beer liquid fill */}
      <path
        d="M7.7 10.5H20.3L18.45 28.9C18.35 29.9 17.5 30.7 16.5 30.7H11.5C10.5 30.7 9.65 29.9 9.55 28.9L7.7 10.5Z"
        fill={fill}
      />
      {/* Foam head */}
      <path
        d="M7.3 7.2H20.7C21.1 7.2 21.4 7.6 21.35 8L21.05 10.5H6.95L6.65 8C6.6 7.6 6.9 7.2 7.3 7.2Z"
        fill="#f8fafc"
        fillOpacity="0.9"
      />
      {/* Subtle vertical glass reflection */}
      <path
        d="M10.2 12.5L11.3 27.5"
        stroke="#ffffff"
        strokeOpacity="0.28"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}
