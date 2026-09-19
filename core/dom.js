/*
 * Tiny DOM builder. All text goes through textContent, never innerHTML,
 * because file contents are untrusted input.
 */
(function (root) {
  'use strict';

  const HCX = root.HCX || (root.HCX = {});

  /**
   * el('td', { className: 'x', text: 'hi', attrs: { title: 't' }, on: { click: fn } }, [child, 'text'])
   * Children may be nodes, strings, or null/undefined/false (skipped).
   */
  function el(tag, props, children) {
    const node = root.document.createElement(tag);
    const { className, text, attrs, on, hidden } = props || {};
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    if (hidden) node.hidden = true;
    Object.entries(attrs || {}).forEach(([name, value]) => {
      if (value !== undefined && value !== null && value !== false) node.setAttribute(name, value === true ? '' : String(value));
    });
    Object.entries(on || {}).forEach(([eventName, handler]) => node.addEventListener(eventName, handler));
    appendChildren(node, children);
    return node;
  }

  function appendChildren(node, children) {
    (children || []).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      node.appendChild(typeof child === 'string' ? root.document.createTextNode(child) : child);
    });
  }

  HCX.dom = { el };
})(globalThis);
