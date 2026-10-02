export function askText(message,initial='') {
  return new Promise(resolve=>window.dispatchEvent(new CustomEvent('dpl-text-prompt',{detail:{message,initial,resolve}})));
}
