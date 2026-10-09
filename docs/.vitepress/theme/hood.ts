// Shared state for the "Under the hood" sections of a page: the Open all / Close all buttons and the "always open" choice.
import { reactive } from "vue";

const KEY = "visualixir-hood-open";
export const hood = reactive({ always: false, target: false, version: 0 });

export function loadHood() {
  try {
    hood.always = localStorage.getItem(KEY) === "1";
  } catch {}
}
export function setAlways(on: boolean) {
  hood.always = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {}
  if (on) setAll(true);
}
export function setAll(open: boolean) {
  hood.target = open;
  hood.version++;
}
