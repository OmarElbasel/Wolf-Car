export const THEME_STORAGE_KEY = "theme";

/**
 * Runs before paint from the server-rendered layout, so there is no flash of
 * the wrong theme. It must stay a plain string: rendering a <script> from a
 * client component makes React warn that it will never execute.
 */
export const THEME_SCRIPT = `(function(){try{
var el=document.documentElement,mq=matchMedia("(prefers-color-scheme: dark)");
var apply=function(d){el.classList.toggle("dark",d);el.style.colorScheme=d?"dark":"light"};
var stored=localStorage.getItem("${THEME_STORAGE_KEY}");
apply(stored?stored==="dark":mq.matches);
mq.addEventListener("change",function(e){if(!localStorage.getItem("${THEME_STORAGE_KEY}"))apply(e.matches)});
}catch(e){}})()`;

/** Flips the theme and remembers the choice. Mirrors THEME_SCRIPT's apply(). */
export function toggleTheme() {
  const el = document.documentElement;
  const dark = !el.classList.contains("dark");
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  try {
    localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
  } catch {}
}
