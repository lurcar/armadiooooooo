export type Theme = "light" | "dark";
const KEY = "armadio-theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
}

export function setTheme(t: Theme) {
  localStorage.setItem(KEY, t);
  document.documentElement.classList.toggle("dark", t === "dark");
}

/** Inline script run before paint so the saved background doesn't flash. */
export const themeScript = `try{if(localStorage.getItem('${KEY}')==='dark')document.documentElement.classList.add('dark')}catch(e){}`;
