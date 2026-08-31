// The report on something that just happened -- see components/toast.
//
// Shared vocabulary rather than a component's private type, because four
// separate acts say their piece the same way: export, copy link, reset, and a
// file import that finishes after its dialog has gone. That last one is why the
// state lives in App rather than in the toolbar that raises most of them.

export interface Notice {
  tone: "ok" | "error";
  message: string;
}
