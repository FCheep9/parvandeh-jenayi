// Tiny DOM helper library — no framework.

/** Create an element. props can include: class, text, html, onclick, attrs, style, dataset. */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k in node && k !== 'list') { try { node[k] = v; } catch { node.setAttribute(k, v); } }
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }
export function mount(parent, ...nodes) { clear(parent); for (const n of nodes) if (n) parent.append(n); return parent; }
export function frag(...nodes) { const f = document.createDocumentFragment(); for (const n of nodes.flat()) if (n) f.append(n); return f; }
export function $(sel, root = document) { return root.querySelector(sel); }

/** Build paragraphs from a string (split on blank lines) or an array of strings. */
export function paragraphs(body, cls = '') {
  const arr = Array.isArray(body) ? body : String(body || '').split(/\n\n+/);
  return arr.filter(Boolean).map((t, i) => el('p', { class: i === 0 && cls ? cls : '', text: t }));
}
