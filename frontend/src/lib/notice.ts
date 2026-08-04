// The one-line report under the toolbar buttons.
//
// Shared vocabulary rather than a component's private type, because four
// separate acts write into the same line: export, copy link, reset, and a file
// import that finishes after its dialog has gone. That last one is why the state
// lives in App -- see the comment on ProgressToolbar's `notice` prop.

export interface Notice {
  tone: "ok" | "error";
  message: string;
}
