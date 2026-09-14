"use strict";

const icons = () => window.lucide?.createIcons({ attrs: { "stroke-width": 1.6 } });
const header = document.querySelector(".docs-header");
if (header) new ResizeObserver(() => {
  document.documentElement.style.setProperty("--docs-header-height", `${header.offsetHeight}px`);
}).observe(header);

const dialog = document.querySelector("#mobile-doc-navigation");
document.querySelector("#open-doc-navigation")?.addEventListener("click", () => dialog.showModal());
document.querySelector("#close-doc-navigation")?.addEventListener("click", () => dialog.close());
dialog?.addEventListener("click", event => {
  const box = dialog.getBoundingClientRect();
  if (event.target.closest("a") || event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom) dialog.close();
});
matchMedia("(min-width: 801px)").addEventListener("change", event => {
  if (event.matches && dialog?.open) dialog.close();
});

document.querySelectorAll("#content .highlight").forEach(block => {
  const pre = block.querySelector("pre");
  if (!pre) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-button copy-code";
  button.title = "Copy code";
  button.setAttribute("aria-label", "Copy code");
  button.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i>';
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.innerText);
      button.title = "Copied";
      button.setAttribute("aria-label", "Copied");
      button.innerHTML = '<i data-lucide="check" aria-hidden="true"></i>';
      icons();
      setTimeout(() => {
        button.title = "Copy code";
        button.setAttribute("aria-label", "Copy code");
        button.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i>';
        icons();
      }, 1600);
    } catch {
      button.title = "Clipboard unavailable";
      button.setAttribute("aria-label", "Clipboard unavailable");
    }
  });
  block.append(button);
});
icons();
