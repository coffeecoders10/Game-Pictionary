import Image from "next/image";

/** Project mark: a pencil standing in a mug of coffee. Inline so it always matches app/icon.svg. */
export function Logo({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden>
  <rect width="64" height="64" rx="15" fill="#03182a"/>
  <rect x="1" y="1" width="62" height="62" rx="14" stroke="#0f3049" strokeWidth="2"/>
  <g strokeLinecap="round" strokeLinejoin="round">
    <path d="M40 36h3a6 6 0 0 1 0 12h-3.500" stroke="#e9dfd2" strokeWidth="2.600"/>
    <path d="M13 30h27v12a12 12 0 0 1-12 12h-3a12 12 0 0 1-12-12z" fill="#2a211c" stroke="#e9dfd2" strokeWidth="2.600"/>
    <ellipse cx="26.500" cy="30" rx="13.500" ry="3" fill="#6b4a36" stroke="#e9dfd2" strokeWidth="2.600"/>
    <g transform="translate(27 31) rotate(16)">
      <rect x="-3.500" y="-23" width="7" height="22" fill="#c99a74"/>
      <path d="M-3.500-23L0-31l3.500 8z" fill="#e9dfd2"/>
      <path d="M-1.200-27.200L0-31l1.200 3.800z" fill="#2a211c"/>
      <rect x="-3.500" y="-23" width="7" height="2.600" fill="#84a0b6"/>
    </g>
    <path d="M13 30a13.500 3 0 0 0 27 0" stroke="#e9dfd2" strokeWidth="2.600"/>
    <path d="M12 58h30" stroke="#84a0b6" strokeWidth="2.600"/>
  </g>
    </svg>
  );
}

/** "Built by CoffeeCoders" stamp. */
export function Stamp() {
  return (
    <p className="stamp">
      <Image src="/coffeecoders_logo.png" alt="" width={36} height={36} />
      <span>Built by CoffeeCoders</span>
    </p>
  );
}
