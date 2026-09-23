const R_PATH =
  "M86 0V1600H437Q639 1600 728.5 1517.0Q818 1434 825 1243Q827 1179 828.0 1127.5Q829 1076 828.0 1025.5Q827 975 825 915Q821 793 784.0 716.5Q747 640 668 601L849 0H575L425 558H345V0ZM345 786H436Q501 786 532.5 815.5Q564 845 567 902Q570 958 571.0 1018.5Q572 1079 571.0 1139.5Q570 1200 567 1256Q564 1313 532.5 1342.5Q501 1372 437 1372H345Z";

export default function LogoMark({ className, title = "Ravi Fitness" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 200"
      width="100%"
      height="100%"
      role="img"
      aria-label={title}
    >
      <rect x="10" y="92" width="180" height="18" rx="9" fill="#c9a24b" transform="rotate(-20 100 100)" />
      <path d={R_PATH} fill="#f5f3ee" transform="translate(64.9375 142) scale(0.075 -0.075)" />
    </svg>
  );
}
