/**
 * Icon set, drawn in the field's own grammar.
 *
 * Every glyph is built from rectangles on a 24-unit grid with `crispEdges`, so
 * nothing anti-aliases and nothing carries a stroke cap that the rest of the
 * page does not have. A cloud is stacked bars; rain is vertical bars under
 * them; fog is four full bars at an even pitch. That is the whole vocabulary,
 * which is why the set reads as one thing at 14px on a phone.
 *
 * `ConditionIcon` maps the icon names produced by services/weather/codes.ts,
 * still the only source of condition semantics.
 */

interface IconProps {
  className?: string;
}

const BASE = "h-5 w-5";

function Glyph({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
      className={className ?? BASE}
    >
      {children}
    </svg>
  );
}

/** The wordmark's companion: a five-bar barcode fragment. */
export function MarkIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="2" y="4" width="2" height="16" />
      <rect x="6" y="7" width="1" height="13" />
      <rect x="9" y="2" width="3" height="18" />
      <rect x="14" y="6" width="1" height="14" />
      <rect x="17" y="9" width="2" height="11" />
      <rect x="21" y="4" width="1" height="16" />
    </Glyph>
  );
}

/** Half solid, half bars: the control that flips the field. */
export function InvertIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="3" width="9" height="18" />
      <rect x="13" y="3" width="1" height="18" />
      <rect x="16" y="3" width="1" height="18" />
      <rect x="19" y="3" width="1" height="18" />
    </Glyph>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="8" y="8" width="8" height="8" />
      <rect x="11" y="1" width="2" height="4" />
      <rect x="11" y="19" width="2" height="4" />
      <rect x="1" y="11" width="4" height="2" />
      <rect x="19" y="11" width="4" height="2" />
      <rect x="4" y="4" width="2" height="2" />
      <rect x="18" y="4" width="2" height="2" />
      <rect x="4" y="18" width="2" height="2" />
      <rect x="18" y="18" width="2" height="2" />
    </Glyph>
  );
}

function CloudBars() {
  return (
    <>
      <rect x="10" y="4" width="6" height="3" />
      <rect x="7" y="8" width="11" height="3" />
      <rect x="4" y="12" width="16" height="3" />
    </>
  );
}

export function CloudIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <CloudBars />
    </Glyph>
  );
}

export function CloudSunIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="3" width="5" height="5" />
      <rect x="2" y="10" width="3" height="2" />
      <rect x="10" y="2" width="2" height="3" />
      <rect x="12" y="7" width="5" height="3" />
      <rect x="9" y="11" width="11" height="3" />
      <rect x="6" y="15" width="14" height="3" />
    </Glyph>
  );
}

export function FogIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="4" width="18" height="2" />
      <rect x="6" y="9" width="14" height="2" />
      <rect x="3" y="14" width="18" height="2" />
      <rect x="7" y="19" width="11" height="2" />
    </Glyph>
  );
}

function Drops({ lengths }: { lengths: Array<[number, number]> }) {
  return (
    <>
      {lengths.map(([x, height]) => (
        <rect key={`${x}-${height}`} x={x} y={17} width="2" height={height} />
      ))}
    </>
  );
}

export function DrizzleIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <CloudBars />
      <Drops lengths={[[7, 2], [12, 3], [17, 2]]} />
    </Glyph>
  );
}

export function RainIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <CloudBars />
      <Drops lengths={[[6, 5], [11, 6], [16, 5]]} />
    </Glyph>
  );
}

export function ShowersIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <CloudBars />
      <Drops lengths={[[5, 6], [8, 4], [11, 7], [14, 4], [17, 6]]} />
    </Glyph>
  );
}

export function SnowIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <CloudBars />
      <rect x="6" y="17" width="2" height="2" />
      <rect x="11" y="17" width="2" height="2" />
      <rect x="16" y="17" width="2" height="2" />
      <rect x="8" y="21" width="2" height="2" />
      <rect x="14" y="21" width="2" height="2" />
    </Glyph>
  );
}

export function ThunderIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <CloudBars />
      <rect x="12" y="16" width="3" height="4" />
      <rect x="9" y="19" width="3" height="4" />
    </Glyph>
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
    <Glyph {...props}>
      <rect x="3" y="11" width="12" height="2" />
      <path d="M14 6 L20 12 L14 18 Z" />
    </Glyph>
  );
}

export function StopIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="6" y="6" width="12" height="12" />
    </Glyph>
  );
}

export function MicIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="10" y="2" width="4" height="10" />
      <rect x="6" y="12" width="2" height="3" />
      <rect x="16" y="12" width="2" height="3" />
      <rect x="8" y="15" width="8" height="2" />
      <rect x="11" y="17" width="2" height="4" />
      <rect x="7" y="21" width="10" height="2" />
    </Glyph>
  );
}

/** A station marker: a plate on a mast. */
export function PinIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="8" y="3" width="8" height="7" />
      <rect x="11" y="10" width="2" height="11" />
      <rect x="6" y="21" width="12" height="2" />
    </Glyph>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="11" y="4" width="2" height="16" />
      <rect x="4" y="11" width="16" height="2" />
    </Glyph>
  );
}

/** A frame, and a stepped diagonal tail. */
export function SearchIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4" y="4" width="12" height="2" />
      <rect x="4" y="14" width="12" height="2" />
      <rect x="4" y="4" width="2" height="12" />
      <rect x="14" y="4" width="2" height="12" />
      <rect x="16" y="16" width="2" height="2" />
      <rect x="18" y="18" width="2" height="2" />
      <rect x="20" y="20" width="2" height="2" />
    </Glyph>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="10" y="2" width="4" height="12" />
      <rect x="10" y="17" width="4" height="4" />
    </Glyph>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="10" y="3" width="4" height="4" />
      <rect x="10" y="10" width="4" height="11" />
    </Glyph>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="4" y="4" width="2" height="2" />
      <rect x="7" y="7" width="2" height="2" />
      <rect x="10" y="10" width="4" height="4" />
      <rect x="15" y="15" width="2" height="2" />
      <rect x="18" y="18" width="2" height="2" />
      <rect x="18" y="4" width="2" height="2" />
      <rect x="15" y="7" width="2" height="2" />
      <rect x="7" y="15" width="2" height="2" />
      <rect x="4" y="18" width="2" height="2" />
    </Glyph>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Glyph {...props}>
      <rect x="3" y="11" width="12" height="2" />
      <path d="M14 7 L19 12 L14 17 Z" />
    </Glyph>
  );
}

/**
 * Work in progress, as a three-bar meter rather than a spinner: a rotating
 * ring is the one motion this field cannot make, and bars are already the unit.
 * Under reduced motion the bars simply stand at full height.
 */
export function MeterIcon({ className }: IconProps) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-end gap-[2px] ${className ?? "h-4 w-4"}`}
    >
      {[0, 140, 280].map((delay) => (
        <span
          key={delay}
          className="animate-meter block h-full w-[2px] origin-bottom bg-current"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
