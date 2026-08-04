// The settings, and the one thing they all have in common: they belong to this
// browser rather than to your progress.
//
// No Save and no Cancel. Every row here takes effect the moment you set it and
// persists on its own, so a footer would only add a way to lose the change you
// just made. Reset has a footer because it destroys something; this doesn't.
//
// Owns its own trigger, the way ResetDialog does. Nothing else opens Settings,
// so lifting the open state into App would buy nothing but two more props.
//
// A setting is a label and a control. The controls that are more than a
// checkbox get their own file -- layout-picker draws four little diagrams, and
// that is a different job from listing what can be set.

import { useState } from "react";
import { Settings } from "lucide-react";
import type { ListPosition } from "@/lib/list-position";
import { LayoutPicker } from "@/components/settings/layout-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/** One switch: a label you can click, and the box it belongs to. */
function SettingRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="hover:bg-muted flex cursor-pointer items-center gap-2.5 rounded px-1.5 py-1.5 text-sm transition-colors">
      <Checkbox
        checked={checked}
        onCheckedChange={(next) => onChange(next === true)}
      />
      <span className="flex-1">{label}</span>
    </label>
  );
}

/** A label, and a control too big to be a checkbox sitting beside it. */
function SettingField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 px-1.5 py-1.5 text-sm">
      <span className="flex-1">{label}</span>
      {children}
    </div>
  );
}

export interface SettingsDialogProps {
  manualTracking: boolean;
  onManualTrackingChange: (allowed: boolean) => void;
  listPosition: ListPosition;
  onListPositionChange: (position: ListPosition) => void;
}

export function SettingsDialog({
  manualTracking,
  onManualTrackingChange,
  listPosition,
  onListPositionChange,
}: SettingsDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Settings">
          <Settings className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-1">
          <SettingRow
            label="Allow manual completion tracking"
            checked={manualTracking}
            onChange={onManualTrackingChange}
          />
          <SettingField label="My list">
            <LayoutPicker
              value={listPosition}
              onChange={onListPositionChange}
            />
          </SettingField>
        </div>
      </DialogContent>
    </Dialog>
  );
}
