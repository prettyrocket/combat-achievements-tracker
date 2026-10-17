// The Load button's icon: the mark of wherever it will load from.

import { PenLine, Upload } from "lucide-react";
import type { QuickLoad } from "@/lib/quick-load";
import runeProfileLogo from "@/assets/logos/runeprofile.png";
import wiseOldManLogo from "@/assets/logos/wiseoldman.svg";

export function LoadIcon({ kind }: { kind: QuickLoad }) {
  switch (kind) {
    case "runeprofile":
      return (
        <img
          src={runeProfileLogo}
          alt=""
          className="size-4 rounded-[3px] object-cover"
        />
      );
    case "wiseoldman":
      return (
        <img src={wiseOldManLogo} alt="" className="size-4 object-cover" />
      );
    case "manual":
      return <PenLine className="size-4" aria-hidden />;
    case "setup":
      return <Upload className="size-4" aria-hidden />;
  }
}
