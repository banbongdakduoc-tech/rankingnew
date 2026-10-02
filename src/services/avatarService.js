export function chooseAvatarImage(file) {
  return new Promise((resolve,reject)=>window.dispatchEvent(new CustomEvent('dpl-avatar-crop',{detail:{file,resolve,reject}})));
}
