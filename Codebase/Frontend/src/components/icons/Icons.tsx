import type { SVGProps } from 'react';

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'children'> & {
  size?: number | string;
};

const baseProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function withDefaults({ size = 18, ...rest }: IconProps) {
  return {
    ...baseProps,
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    'aria-hidden': true,
    focusable: false,
    ...rest,
  };
}

export function IconUpload(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M12 16V4" />
      <path d="m6 10 6-6 6 6" />
      <path d="M4 18v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 18 9 5 9-5" />
    </svg>
  );
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m10 9 5 3-5 3V9Z" />
    </svg>
  );
}

export function IconBook(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2V5Z" />
      <path d="M4 19a2 2 0 0 1 2-2h12" />
    </svg>
  );
}

export function IconCheckSquare(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M6 6 18 18" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function IconChevronRight(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function IconLock(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="4.5" y="11" width="15" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="m5 12 5 5 9-11" />
    </svg>
  );
}

export function IconBeaker(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M9 3h6" />
      <path d="M10 3v6L4.5 18a2 2 0 0 0 1.7 3h11.6a2 2 0 0 0 1.7-3L14 9V3" />
      <path d="M7.5 14h9" />
    </svg>
  );
}

export function IconCode(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
      <path d="m14 5-4 14" />
    </svg>
  );
}

export function IconAcademicCap(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M3 9 12 4l9 5-9 5-9-5Z" />
      <path d="M7 11v5a5 5 0 0 0 10 0v-5" />
      <path d="M21 9v6" />
    </svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <path d="M12 3 4 6v6c0 4.5 3.4 8.4 8 9 4.6-.6 8-4.5 8-9V6l-8-3Z" />
    </svg>
  );
}

export function IconClipboard(props: IconProps) {
  return (
    <svg {...withDefaults(props)}>
      <rect x="6" y="4" width="12" height="17" rx="2" />
      <path d="M9 4v-.5A1.5 1.5 0 0 1 10.5 2h3A1.5 1.5 0 0 1 15 3.5V4" />
      <path d="M9 11h6" />
      <path d="M9 15h4" />
    </svg>
  );
}
