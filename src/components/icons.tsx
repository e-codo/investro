import type { ReactNode } from "react";

const icon = (paths: ReactNode) =>
  function Icon() {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {paths}
      </svg>
    );
  };

export const PlusIcon = icon(<path d="M12 5v14M5 12h14" />);
export const SettingsIcon = icon(
  <>
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </>,
);
export const LogoutIcon = icon(<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />);
export const LeftIcon = icon(<path d="M15 18l-6-6 6-6" />);
export const RightIcon = icon(<path d="M9 6l6 6-6 6" />);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
