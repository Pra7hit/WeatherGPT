/**
 * Inline SVG icons.
 *
 * Hand-rolled rather than a dependency: the set is small, they inherit
 * `currentColor` so dark mode needs no extra work, and there is no icon-font
 * request at load. `ConditionIcon` maps the icon names produced by
 * services/weather/codes.ts, which is the only source of condition semantics.
 */

interface IconProps {
  className?: string;
}

const BASE = "h-5 w-5";

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className ?? BASE}
    >
      {children}
    </svg>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
    </Svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z" />
    </Svg>
  );
}

function CloudShape() {
  return <path d="M6.5 18h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.2A3.9 3.9 0 0 0 6.5 18Z" />;
}

export function CloudIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <CloudShape />
    </Svg>
  );
}

export function CloudSunIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="7" r="2.6" />
      <path d="M8 2.2v1.2M3.2 7H2M12.8 7H14M4.6 3.6l.9.9M11.4 3.6l-.9.9" />
      <path d="M9 19h8a3 3 0 0 0 .2-6 4.8 4.8 0 0 0-9-1.1A3.4 3.4 0 0 0 9 19Z" />
    </Svg>
  );
}

export function FogIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 14h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.2A3.9 3.9 0 0 0 6.5 14Z" />
      <path d="M4 18h16M6 21.5h12" />
    </Svg>
  );
}

export function DrizzleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 15h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.2A3.9 3.9 0 0 0 6.5 15Z" />
      <path d="M9 18.5v1M12 19v1.5M15 18.5v1" />
    </Svg>
  );
}

export function RainIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 14.5h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.2A3.9 3.9 0 0 0 6.5 14.5Z" />
      <path d="M8.5 17.5 7.5 21M12 17.5 11 21M15.5 17.5 14.5 21" />
    </Svg>
  );
}

export function ShowersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 13.5h10a3.2 3.2 0 0 0 .3-6.4A5.2 5.2 0 0 0 7.4 6A3.7 3.7 0 0 0 7 13.5Z" />
      <path d="M9 16.5 8 19.5M13 16.5l-1 3M16.5 16.5l-1 3M10.5 20.5l-.4 1.3" />
    </Svg>
  );
}

export function SnowIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 14h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.2A3.9 3.9 0 0 0 6.5 14Z" />
      <path d="M9 18h.01M12 20h.01M15 18h.01M12 17h.01" />
    </Svg>
  );
}

export function ThunderIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M6.5 14h11a3.5 3.5 0 0 0 .3-7 5.5 5.5 0 0 0-10.6-1.2A3.9 3.9 0 0 0 6.5 14Z" />
      <path d="M13 16h-2.5l-1.5 3.5h2L10 23l4-4.5h-2Z" />
    </Svg>
  );
}

const CONDITION_ICONS: Record<string, (props: IconProps) => React.ReactElement> = {
  sun: SunIcon,
  "cloud-sun": CloudSunIcon,
  cloud: CloudIcon,
  fog: FogIcon,
  drizzle: DrizzleIcon,
  rain: RainIcon,
  showers: ShowersIcon,
  snow: SnowIcon,
  thunder: ThunderIcon,
};

export function ConditionIcon({ icon, className }: { icon: string; className?: string }) {
  const Component = CONDITION_ICONS[icon] ?? CloudIcon;
  return <Component className={className} />;
}

export function SendIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4.5 12 20 4.5 12.5 20l-1.8-6.2L4.5 12Z" />
    </Svg>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4a2.6 2.6 0 0 1 2.6 2.6v4.6a2.6 2.6 0 0 1-5.2 0V6.6A2.6 2.6 0 0 1 12 4Z" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17.5V21M9 21h6" />
    </Svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 21s6.5-5.6 6.5-10.4A6.5 6.5 0 0 0 5.5 10.6C5.5 15.4 12 21 12 21Z" />
      <circle cx="12" cy="10.4" r="2.3" />
    </Svg>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.4 3.4 8.5S14.3 18.1 12 20.5C9.7 18.1 8.6 15.1 8.6 12S9.7 5.9 12 3.5Z" />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </Svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4.5 21 19.5H3L12 4.5Z" />
      <path d="M12 10v4M12 16.8h.01" />
    </Svg>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </Svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  );
}

export function SpinnerIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`${className ?? BASE} animate-spin`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
