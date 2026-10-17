// The Load button's icon: the mark of wherever it will load from.

import { Upload } from "lucide-react";
import type { QuickLoad } from "@/lib/quick-load";
import { SourceLogo } from "@/components/source-cards";

export function LoadIcon({ kind }: { kind: QuickLoad }) {
  switch (kind) {
    case "runeprofile":
      return (
        <SourceLogo source="runeprofile" className="size-4 rounded-[3px]" />
      );
    case "wiseoldman":
    case "manual":
      return <SourceLogo source={kind} className="size-4" />;
    case "setup":
      return <Upload className="size-4" aria-hidden />;
  }
}
