// Which pages the reader has marked as read. Kept in the browser only (localStorage), never sent anywhere.
import { reactive } from "vue";

const KEY = "visualixir-read";
export const read = reactive({ pages: [] as string[], loaded: false });

export function loadRead() {
  if (read.loaded) return;
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    read.pages = Array.isArray(v) ? v.filter((p) => typeof p === "string") : [];
  } catch {}
  read.loaded = true;
}
const save = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(read.pages));
  } catch {}
};
export const isRead = (path: string) => read.pages.includes(path);
export function setRead(path: string, on: boolean) {
  read.pages = on ? [...new Set([...read.pages, path])] : read.pages.filter((p) => p !== path);
  save();
}
export function resetRead() {
  read.pages = [];
  save();
}
