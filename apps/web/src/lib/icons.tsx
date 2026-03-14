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
