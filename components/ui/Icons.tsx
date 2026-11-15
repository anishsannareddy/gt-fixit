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
export const MapIcon = base(["M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Z", "M9 4v13.5M15 6.5V20"]);
export const BoltIcon = base("M13 2 4 14h7l-1 8 9-12h-7l1-8Z");
export const DropletIcon = base("M12 3s6.5 6.6 6.5 11.2A6.5 6.5 0 0 1 5.5 14.2C5.5 9.6 12 3 12 3Z");
export const ThermometerIcon = base(["M14 14.8V5a2 2 0 1 0-4 0v9.8a4 4 0 1 0 4 0Z", "M12 9v8"]);
export const ElevatorIcon = base(["M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z", "M12 3v18", "m7 10 1.5-2L10 10M14 14l1.5 2 1.5-2"]);
export const BulbIcon = base(["M9 18h6M10 21h4", "M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1.1 2.2h5c.1-1 .5-1.700 1.100-2.200A6 6 0 0 0 12 3Z"]);
export const LockIcon = base(["M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z", "M8 11V7a4 4 0 0 1 8 0v4"]);
export const ChairIcon = base(["M7 12V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v7", "M5 12h14v4H5z", "M7 16v5M17 16v5"]);
export const SparkleIcon = base(["M12 3l1.8 5.2L19 10l-5.2 1.800L12 17l-1.800-5.200L5 10l5.200-1.800L12 3Z", "M19 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z"]);
export const BugIcon = base(["M8 9a4 4 0 0 1 8 0v6a4 4 0 0 1-8 0V9Z", "M12 9v10M4 13h4M16 13h4M5 7l3 2.500M19 7l-3 2.500M5 20l3-2.500M19 20l-3-2.500M9 5 8 3M15 5l1-2"]);
export const ApplianceIcon = base(["M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z", "M5 8h14", "M12 18a3.500 3.500 0 1 0 0-7 3.500 3.500 0 0 0 0 7Z", "M8 5.500h.01M11 5.500h.01"]);
export const DotsIcon = base(["M5 12h.01M12 12h.01M19 12h.01"]);
export const FilterIcon = base("M3 5h18l-7 8.500V20l-4-2v-4.500L3 5Z");
export const RefreshIcon = base(["M20 11a8 8 0 0 0-14.900-3M4 4v4h4", "M4 13a8 8 0 0 0 14.900 3M20 20v-4h-4"]);
export const LogoutIcon = base(["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"]);
export const MailIcon = base(["M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z", "m3 7 9 6 9-6"]);
export const PlayIcon = base("M7 4.500v15l12-7.500-12-7.500Z");
export const HandIcon = base(["M8 12V5.500a1.500 1.500 0 0 1 3 0V11", "M11 11V4.500a1.500 1.500 0 0 1 3 0V11", "M14 11V6a1.500 1.500 0 0 1 3 0v8a7 7 0 0 1-7 7c-2.500 0-4-1-5.500-3.500L3 14.500a1.500 1.500 0 0 1 2.500-1.500L8 15"]);
