const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function ambiente() {
  let templates = 0;
  class Node {
    constructor(name, attrs = {}, text = null) {
      this.nodeName = name;
      this.nodeType = text === null ? 1 : 3;
      this.nodeValue = text;
      this.attrs = { ...attrs };
      this.childNodes = [];
      this.ownerDocument = document;
    }
    get attributes() { return Object.entries(this.attrs).map(([name, value]) => ({ name, value })); }
    get firstChild() { return this.childNodes[0] || null; }
    get nextSibling() { return this.parent?.childNodes[this.parent.childNodes.indexOf(this) + 1] || null; }
    get outerHTML() { return `<${this.nodeName}${this.attributes.map((a) => ` ${a.name}="${a.value}"`).join('')}>${this.childNodes.map((child) => child.nodeType === 3 ? child.nodeValue : child.outerHTML).join('')}</${this.nodeName}>`; }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    insertBefore(node, cursor) {
      if (node === cursor) return;
      node.remove();
      const index = cursor ? this.childNodes.indexOf(cursor) : this.childNodes.length;
      this.childNodes.splice(index, 0, node);
      node.parent = this;
    }
    remove() { if (this.parent) this.parent.childNodes.splice(this.parent.childNodes.indexOf(this), 1); this.parent = null; }
    cloneNode(deep) {
      const result = new Node(this.nodeName, this.attrs, this.nodeValue);
      if (deep) this.childNodes.forEach((child) => result.insertBefore(child.cloneNode(true), null));
      return result;
    }
  }
  const document = { createElement(name) {
    assert.equal(name, 'template');
    templates += 1;
    const content = new Node('fragment');
    return { content, set innerHTML(html) {
      for (const [, id, text] of html.matchAll(/<button data-conversation-id="([^"]+)">([^<]*)<\/button>/g)) {
        const button = new Node('button', { 'data-conversation-id': id });
        button.insertBefore(new Node('#text', {}, text), null);
        content.insertBefore(button, null);
      }
    } };
  } };
  const ctx = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../frontend/chat-dom.js'), 'utf8'), ctx);
  return { render: ctx.window.ChatDOM.render, root: new Node('main'), templates: () => templates, Node };
}

test('lista idêntica não cria template nem substitui nós ou estado local de mídia', () => {
  const env = ambiente();
  const html = '<button data-conversation-id="1">Maria</button>';
  assert.equal(env.render(env.root, html), true);
  const button = env.root.firstChild;
  const media = new env.Node('audio');
  button.insertBefore(media, null);
  assert.equal(env.render(env.root, html), false);
  assert.equal(env.root.firstChild, button);
  assert.equal(button.childNodes.at(-1), media);
  assert.equal(env.templates(), 1);
});

test('reordena cartões pela chave sem recriar os existentes nem duplicar eventos', () => {
  const env = ambiente();
  env.render(env.root, '<button data-conversation-id="1">Maria</button><button data-conversation-id="2">João</button>');
  const [maria, joao] = env.root.childNodes;
  env.render(env.root, '<button data-conversation-id="2">João</button><button data-conversation-id="1">Maria</button>');
  assert.deepEqual(env.root.childNodes, [joao, maria]);
  assert.equal(env.root.childNodes.length, 2);
});

test('limpeza externa da lista invalida o atalho de renderização', () => {
  const env = ambiente();
  const html = '<button data-conversation-id="1">Maria</button>';
  env.render(env.root, html);
  env.root.firstChild.remove();
  assert.equal(env.render(env.root, html), true);
  assert.equal(env.root.firstChild.getAttribute('data-conversation-id'), '1');
});
