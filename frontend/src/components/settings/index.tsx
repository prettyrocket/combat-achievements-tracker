// The settings, and the one thing they all have in common: they belong to this
// browser rather than to your progress.
//
// No Save and no Cancel. Every row here takes effect the moment you set it and
// persists on its own, so a footer would only add a way to lose the change you
// just made. Reset has a footer because it destroys something; this doesn't.
//
// Opened from the toolbar's menu, which owns the open state; the dialog can't
// be its own trigger from inside a menu that closes as you pick it.
//
// A setting is a label and a control. The controls that are more than a
// checkbox get their own file -- layout-picker draws four little diagrams, and
// that is a different job from listing what can be set.

import type { ListPosition } from "@/lib/list-position";
import { LayoutPicker } from "@/components/settings/layout-picker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  open: boolean;
  onOpenChange: (open: boolean) => void;
  manualTracking: boolean;
  onManualTrackingChange: (allowed: boolean) => void;
  listPosition: ListPosition;
  onListPositionChange: (position: ListPosition) => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  manualTracking,
  onManualTrackingChange,
  listPosition,
  onListPositionChange,
}: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
