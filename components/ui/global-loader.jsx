"use client";

// A simple, elegant SVG spinner component
const Spinner = () => (
  <svg
    className="animate-spin h-10 w-10 text-blue-600"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

/**
 * A full-page loader component, used for critical states like initial authentication.
 */
export default function GlobalLoader({ text = "Loading..." }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="flex flex-col items-center justify-center gap-4">
        <Spinner />
        <p className="text-lg font-medium text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}