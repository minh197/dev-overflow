import type { JSX, SVGProps } from "react";

export type AppIcon = (props: SVGProps<SVGSVGElement>) => JSX.Element;

function createIcon(path: JSX.Element): AppIcon {
  return function Icon(props: SVGProps<SVGSVGElement>) {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    );
  };
}

export const HouseIcon = createIcon(
  <>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10.5V20h14v-9.5" />
    <path d="M10 20v-5h4v5" />
  </>,
);

export const FolderOpenIcon = createIcon(
  <>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5V10" />
    <path d="M3.5 10.5h17L18 19H5.5L3.5 10.5Z" />
  </>,
);

export const BriefcaseBusinessIcon = createIcon(
  <>
    <path d="M9 6V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6" />
    <path d="M4 7h16a1 1 0 0 1 1 1v9.5A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5V8a1 1 0 0 1 1-1Z" />
    <path d="M3 12h18" />
    <path d="M10 12v2h4v-2" />
  </>,
);

export const TagIcon = createIcon(
  <>
    <path d="M11 3H5a2 2 0 0 0-2 2v6l9.5 9.5a2.12 2.12 0 0 0 3 0l5-5a2.12 2.12 0 0 0 0-3L11 3Z" />
    <path d="M7.5 7.5h.01" />
  </>,
);

export const UsersIcon = createIcon(
  <>
    <path d="M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
    <path d="M9.5 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
    <path d="M21 21v-1a4 4 0 0 0-3-3.87" />
    <path d="M16.5 4.13a4 4 0 0 1 0 7.75" />
  </>,
);

export const CircleHelpIcon = createIcon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.86.76-1.7 1.3-1.7 2.7" />
    <path d="M12 17h.01" />
  </>,
);

export const FlameIcon = createIcon(
  <>
    <path d="M12 3c1.8 3 4.6 4.8 4.6 8.4A4.6 4.6 0 0 1 12 16a4.1 4.1 0 0 1-3.8-2.5" />
    <path d="M10.2 8.3c-2 1.5-3.2 3-3.2 5A5 5 0 0 0 12 18a5 5 0 0 0 5-4.7c0-2.6-1.4-4-2.8-5.3" />
    <path d="M12 21a4 4 0 0 1-4-4c0-2 1.2-3.2 2.3-4.2A5.5 5.5 0 0 0 14 17a4 4 0 0 1-2 4Z" />
  </>,
);

export const LogOutIcon = createIcon(
  <>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </>,
);

export const MoonStarIcon = createIcon(
  <>
    <path d="M12 3a6 6 0 0 0 9 7.8A9 9 0 1 1 12 3Z" />
    <path d="m19 3 .6 1.4L21 5l-1.4.6L19 7l-.6-1.4L17 5l1.4-.6L19 3Z" />
  </>,
);

export const SearchIcon = createIcon(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </>,
);

export const ListFilterIcon = createIcon(
  <>
    <path d="M3 6h18" />
    <path d="M7 12h10" />
    <path d="M10 18h4" />
  </>,
);

export const ChevronDownIcon = createIcon(
  <>
    <path d="m6 9 6 6 6-6" />
  </>,
);

export const FileQuestionIcon = createIcon(
  <>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
    <path d="M14 3v5h5" />
    <path d="M10 12a2 2 0 1 1 3.3 1.5c-.67.54-1.3.92-1.3 1.9" />
    <path d="M12 18h.01" />
  </>,
);

export const MessageSquareQuoteIcon = createIcon(
  <>
    <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
    <path d="M9 9h.01" />
    <path d="M13 9h.01" />
    <path d="M9 13h6" />
  </>,
);

export const ArrowLeftIcon = createIcon(
  <>
    <path d="m12 19-7-7 7-7" />
    <path d="M19 12H5" />
  </>,
);

export function GitHubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.48 2 2 6.58 2 12.22c0 4.5 2.87 8.32 6.84 9.67.5.1.68-.22.68-.5 0-.24-.01-1.05-.02-1.91-2.78.62-3.37-1.21-3.37-1.21-.46-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.54 1.05 1.54 1.05.9 1.56 2.36 1.11 2.93.85.09-.67.35-1.12.64-1.38-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.35 9.35 0 0 1 12 6.84c.85 0 1.7.12 2.5.36 1.9-1.33 2.74-1.05 2.74-1.05.56 1.41.21 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.79-4.57 5.05.36.31.68.92.68 1.86 0 1.34-.01 2.42-.01 2.75 0 .27.18.6.69.5A10.16 10.16 0 0 0 22 12.22C22 6.58 17.52 2 12 2Z" />
    </svg>
  );
}

export function GoogleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        fill="#EA4335"
        d="M12.24 10.29v3.8h5.4c-.24 1.22-.95 2.25-2 2.94l3.24 2.55c1.89-1.78 2.98-4.39 2.98-7.49 0-.73-.06-1.43-.19-2.11h-9.43Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.91 6.61-2.47l-3.24-2.55c-.9.62-2.05.99-3.37.99-2.59 0-4.78-1.79-5.56-4.2H3.09v2.63A9.98 9.98 0 0 0 12 22Z"
      />
      <path
        fill="#4A90E2"
        d="M6.44 13.77A6.1 6.1 0 0 1 6.13 12c0-.61.11-1.2.31-1.77V7.6H3.09A10.14 10.14 0 0 0 2 12c0 1.63.39 3.18 1.09 4.4l3.35-2.63Z"
      />
      <path
        fill="#FBBC05"
        d="M12 6.03c1.47 0 2.78.52 3.82 1.54l2.86-2.93C16.96 2.98 14.7 2 12 2A9.98 9.98 0 0 0 3.09 7.6l3.35 2.63c.78-2.41 2.97-4.2 5.56-4.2Z"
      />
    </svg>
  );
}
