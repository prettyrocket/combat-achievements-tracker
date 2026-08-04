// The two smallest shared pieces: a bar, and a link to a hilt.
//
// Plain CSS bars. Six values do not need a chart library, and a <div> with a
// width is both smaller and more accessible than anything a library would
// render for this.

import { itemWikiUrl } from "@/lib/wiki";

export function Meter({
  value,
  className,
}: {
  value: number;
  className: string;
}) {
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${className}`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

export function HiltLink({ hilt }: { hilt: string }) {
  return (
    <a
      href={itemWikiUrl(hilt)}
      target="_blank"
      rel="noreferrer"
      className="font-medium underline decoration-dotted underline-offset-2"
    >
      {hilt}
    </a>
  );
}
