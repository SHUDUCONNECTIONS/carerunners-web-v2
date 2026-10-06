import * as React from "react";

// South African Rand sign (an "R" in a circle), drawn like the lucide icons so it
// can replace the dollar-sign icon: same size, stroke and currentColor.
export function RandIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.5 17V7h3.5a3 3 0 0 1 0 6H9.5" />
      <path d="M13 13l3 4" />
    </svg>
  );
}

export default RandIcon;
