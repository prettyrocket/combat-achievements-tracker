// The settings, and the one thing they all have in common: they belong to this
// browser rather than to your progress.
//
// No Save and no Cancel. Every row here takes effect the moment you set it and
// persists on its own, so a footer would only add a way to lose the change you
// just made. Reset has a footer because it destroys something; this doesn't.
//
// Owns its own trigger, the way ResetDialog does. Nothing else opens Settings,
// so lifting the open state into App would buy nothing but two more props.

import { useState } from "react";
import { Settings } from "lucide-react";
import { LIST_POSITIONS, type ListPosition } from "@/lib/list-position";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

/** One choice out of a handful: a label, and the menu it belongs to. */
function SettingChoice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly { id: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-1.5 py-1.5 text-sm">
      <span className="flex-1">{label}</span>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger size="sm" className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
          <SettingChoice
            label="My list"
            value={listPosition}
            options={LIST_POSITIONS}
            onChange={onListPositionChange}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
