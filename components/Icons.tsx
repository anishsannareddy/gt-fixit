// Small inline icon set (Heroicons-style outline paths) so we don't need an icon library.
type P = { className?: string };
const base = (d: string | string[]) =>
  function Icon({ className = "size-5" }: P) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
        {(Array.isArray(d) ? d : [d]).map((p) => (
          <path key={p} d={p} />
        ))}
      </svg>
    );
  };

export const PlusIcon = base("M12 5v14M5 12h14");
export const ListIcon = base(["M8 6h13M8 12h13M8 18h13", "M3.5 6h.01M3.5 12h.01M3.5 18h.01"]);
export const WrenchIcon = base("M14.7 6.3a4 4 0 0 0 5 5L21 13l-8 8-3-3 6.3-6.3a4 4 0 0 1-5-5L10 5l3-3 1.7 1.7a4 4 0 0 0 0 2.6Z");
export const ChartIcon = base(["M4 20V10M10 20V4M16 20v-7M22 20H2"]);
export const CameraIcon = base(["M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"]);
export const BuildingIcon = base(["M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16", "M16 9h2a2 2 0 0 1 2 2v10", "M2 21h20", "M8 7h4M8 11h4M8 15h4"]);
export const PinIcon = base(["M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11Z", "M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"]);
export const ClockIcon = base(["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "M12 7v5l3 2"]);
export const CheckIcon = base("M5 12.5 10 17 19 7");
export const XIcon = base("M6 6l12 12M18 6 6 18");
export const ChevronRightIcon = base("m9 6 6 6-6 6");
export const ArrowLeftIcon = base("M19 12H5m6-6-6 6 6 6");
export const SwitchIcon = base(["M7 4 3 8l4 4", "M3 8h14", "m17 20 4-4-4-4", "M21 16H7"]);
export const SearchIcon = base(["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.3-4.3"]);
export const UserIcon = base(["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"]);
export const AlertIcon = base(["M12 9v4M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"]);
