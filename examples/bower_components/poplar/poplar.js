;(function(define){'use strict';define(function(require,exports,module){
/*jshint esnext:true*/

var debug = 0 ? console.log.bind(console, '[poplar]') : function() {};
var elements = new WeakMap();

var regex = {
  content: />([^<]+)</g,
  var: /\$\{([^\}]+)\}/g,
  attrs: /(<[a-z\-]+ )(.+?)( ?\/>|>)/g,
  attr: /([a-z\-]+)="([^\"]+\$\{[^\"]+|\$[^"]+)"/g
};

/**
 * Exports
 */

module.exports = poplar;

/**
 * Create a poplar element
 * from an HTML string.
 *
 * @param  {String} html
 * @return {HTMLElement}
 */
function poplar(html) {
  debug('poplar', html);

  var formatted = html
    .replace(/\n/g, '')
    .replace(/  +/g, '')

    // attribute bindings
    .replace(regex.attrs, function(match, start, content, end) {
      var dynamic = [];
      var simple = content.replace(regex.attr, function(match, name, prop) {
        dynamic.push(`${name}=${encodeURIComponent(prop)}`);
        return '';
      });

      // Return original if no dynamic attrs were found
      if (!dynamic.length) return match;

      var dataBindAttrs = dynamic.join(' ');
      var tag = `${start}${simple} data-poplar-attrs="${dataBindAttrs}"${end}`;
      return tag.replace(/  +/g, ' ');
    })

    // textNode bindings
    .replace(regex.content, function(m, content) {
      return m.replace(regex.var, function(m, group) {
        return '<span data-poplar-text="' + group + '"></span>';
      });
    });

  var parent = rocify(elementify(formatted));
  var el = parent.firstElementChild;

  elements.set(el, {
    textNodes: replaceTextPlaceholders(parent),
    attrs: replaceAttrPlaceholders(parent)
  });

  return el;
}

/**
 * Populate the element with data.
 *
 * @param  {HTMLElement} el   poplar element
 * @param  {Object} data  Data to fill
 * @public
 */
poplar.populate = function(el, data) {
  debug('poplate', el, data);

  var bindings = elements.get(el);
  var textNodes = bindings.textNodes;
  var attrs = bindings.attrs;
  var i = textNodes.length;
  var j = attrs.length;

  // text nodes
  while (i--) {
    textNodes[i].node.data = getProp(data, textNodes[i].key);
  }

  // attributes
  while (j--) {
    var item = attrs[j];

    // If the variable is part of an
    // attribute string it must be
    // templated each time
    var value = item.template
      ? interpolate(item.template, data)
      : getProp(data, item.prop);

    item.el.setAttribute(item.name, value);
  }
};

/**
 * Template a string.
 *
 * @example
 *
 * interpolate('foo ${bar}', { bar: 'bar'}); //=> 'foo bar'
 *
 * @param  {String} string
 * @param  {Object} data
 * @return {String}
 */
function interpolate(string, data) {
  return string.replace(regex.var, function(match, group) {
    return getProp(data, group);
  });
}

/**
 * Replace the <span> textNode placeholders
 * with real textNodes and return a references.
 *
 * @param  {HTMLElement} el
 * @return {Array}
 */
function replaceTextPlaceholders(el) {
  var placeholders = el.querySelectorAll('[data-poplar-text]');
  var i = placeholders.length;
  var result = [];

  while (i--) {
    var node = document.createTextNode('');
    placeholders[i].parentNode.replaceChild(node, placeholders[i]);
    result.push({
      key: placeholders[i].dataset.poplarText,
      node: node
    });
  }

  return result;
}

/**
 * Remove the [data-poplar-attr] reference
 * and return a list of all dynamic attributes.
 *
 * @param  {HTMLElement} el
 * @return {Array}
 */
function replaceAttrPlaceholders(el) {
  var placeholders = el.querySelectorAll('[data-poplar-attrs]');
  var i = placeholders.length;
  var result = [];

  while (i--) {
    var attrs = placeholders[i].dataset.poplarAttrs.split(' ');
    var j = attrs.length;

    while (j--) {
      var parts = attrs[j].split('=');
      var value = decodeURIComponent(parts[1]);
      var attr = {
        name: parts[0],
        el: placeholders[i]
      };

      // If the variable is *part* of the whole string
      // we must interpolate the variable into the string
      // each time .populate() is called. If the variable
      // fills the entire string we can slam it straight in.
      if (isPartial(value)) attr.template = value;
      else attr.prop = value.replace(regex.var, '$1');

      result.push(attr);
    }

    placeholders[i].removeAttribute('data-poplar-attrs');
  }

  return result;
}

/**
 * Detect if variable is part of
 * a larger string.
 *
 * @example
 *
 * isPartial('before ${foo}') //=> true
 * isPartial('${foo} after') //=> true
 * isPartial('${foo}') //=> false
 *
 * @param  {String}  value
 * @return {Boolean}
 */
function isPartial(value) {
  return !/^\$\{.+\}$/.test(value);
}

/**
 * Turn an HTML String into an element.
 *
 * @param  {String} html
 * @return {HTMLElement}
 */
function elementify(html) {
  var div = document.createElement('div');
  div.innerHTML = html;
  return div;
}

/**
 * Get a property from an object,
 * supporting dot notation for
 * deep properties.
 *
 * @example
 *
 * getProp({ foo: { bar: 1 }}, 'foo.bar') //=> 1
 *
 * @param  {[type]} item [description]
 * @param  {[type]} path [description]
 * @return {[type]}      [description]
 */
function getProp(object, path) {
  if (!path) return;

  var parts = path.split('.');

  // Fast paths
  if (parts.length == 1) return object[parts[0]];
  if (parts.length == 2) return object[parts[0]][parts[1]];

  return (function getDeep(object, parts) {
    var part = parts.shift();
    return parts.length ? getDeep(object[part], parts) : object[part];
  })(object, parts);
}

/**
 * Removes empty text nodes recursively
 * to optimize rendering performance.
 *
 * @param  {HTMLElement} el
 */
function rocify(el) {
  if (el.childNodes.length === 0) return el;
  var i = el.childNodes.length;

  // Will remove elements while iterating
  while (i--) {
    var child = el.childNodes[i];

    if (!child.tagName && !child.data.replace(/\s/g, '').length) {
      child.remove();
      continue;
    }

    rocify(child);
  }

  return el;
}

});})(typeof define=='function'&&define.amd?define
:(function(n,w){'use strict';return typeof module=='object'?function(c){
c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){
return w[n];},m.exports,m);w[n]=m.exports;};})('poplar',this));
