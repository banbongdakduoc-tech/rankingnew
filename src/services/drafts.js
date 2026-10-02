export function readDraft(){try{const owner=JSON.parse(localStorage.getItem('dpl_user') || 'null')?.username;return owner?JSON.parse(localStorage.getItem(`dpl-draft-v2-${owner}`) || 'null'):null;}catch{return null;}}
export function saveDraft(draft){const owner=JSON.parse(localStorage.getItem('dpl_user') || 'null')?.username;if(owner)localStorage.setItem(`dpl-draft-v2-${owner}`,JSON.stringify({...draft,savedAt:Date.now()}));}
export function clearDraft(){const owner=JSON.parse(localStorage.getItem('dpl_user') || 'null')?.username;if(owner)localStorage.removeItem(`dpl-draft-v2-${owner}`);}
