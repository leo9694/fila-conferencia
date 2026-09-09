(function (root) {
  'use strict';
  const markup = new WeakMap();
  function key(node) {
    if (node.nodeType !== 1) return null;
    for (const name of ['data-message-id', 'data-conversation-id', 'data-call-id']) {
      if (node.hasAttribute(name)) return `${name}:${node.getAttribute(name)}`;
    }
    return null;
  }
  function sync(parent, incoming) {
    const keyed = new Map(Array.from(parent.childNodes).map((node) => [key(node), node]).filter(([id]) => id));
    let cursor = parent.firstChild;
    for (const source of Array.from(incoming.childNodes)) {
      const id = key(source);
      let target = id ? keyed.get(id) : cursor;
      if (!target || key(target) !== id || target.nodeType !== source.nodeType || target.nodeName !== source.nodeName) {
        target = source.cloneNode(true);
        parent.insertBefore(target, cursor);
      } else if (target !== cursor) {
        parent.insertBefore(target, cursor);
      }
      const value = source.nodeType === 1 ? source.outerHTML : source.nodeValue;
      if (markup.get(target) !== value) {
        if (source.nodeType === 1) {
          for (const attribute of Array.from(target.attributes)) {
            if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
          }
          for (const attribute of Array.from(source.attributes)) {
            if (target.getAttribute(attribute.name) !== attribute.value) target.setAttribute(attribute.name, attribute.value);
          }
          sync(target, source);
        } else if (target.nodeValue !== source.nodeValue) target.nodeValue = source.nodeValue;
        markup.set(target, value);
      }
      cursor = target.nextSibling;
    }
    while (cursor) {
      const next = cursor.nextSibling;
      cursor.remove();
      cursor = next;
    }
  }
  root.ChatDOM = {
    render(element, html) {
      const template = element.ownerDocument.createElement('template');
      template.innerHTML = html;
      sync(element, template.content);
    }
  };
}(window));
