;(function(define){'use strict';define(function(require,exports,module){

/**
 * Dependencies
 */

var component = require('gaia-component');
var FastList = require('fast-list');
var poplar = require('poplar');

/**
 * Mini Logger
 */
var debug = 0 ? (...args) => console.log('[GaiaFastList]', ...args) : ()=>{};

/**
 * Used to hide private poperties behind.
 * @type {Symbol}
 */
var internal = Symbol();

/**
 * Public prototype.
 * @type {Object}
 */
var GaiaFastListProto = {
  extensible: false,

  created: function() {
    this.setupShadowRoot();
    this.top = this.getAttribute('top');
    this.bottom = this.getAttribute('bottom');
    this[internal] = new Internal(this);
    debug('created');
  },

  configure: function(props) {
    this[internal].configure(props);
  },

  attrs: {
    model: {
      get: function() { return this[internal].model; },
      set: function(value) {
        this[internal].setModel(value);
      }
    },

    top: {
      get: function() { return this._top; },
      set: function(value) {
        debug('set top', value);
        if (value == null) return;
        value = Number(value);
        if (value === this._top) return;
        this.setAttribute('top', value);
        this._top = value;
      }
    },

    bottom: {
      get: function() { return this._bottom; },
      set: function(value) {
        debug('set bottom', value);
        if (value == null) return;
        value = Number(value);
        if (value === this._bottom) return;
        this.setAttribute('bottom', value);
        this._bottom = value;
      }
    }
  },

  template: `
    <section class="fast-list">
      <ul><content></content></ul>
    </section>

    <style>
      * { margin: 0; font: inherit; }

      :host {
        display: block;
        height: 100%;
      }

      .fast-list {
        height: 100%;
        position: relative;
      }

      .fast-list ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      ::content .gfl-header {
        position: sticky;
        position: -webkit-sticky;
        top: 0px;
        height: 32px;
        z-index: 100;

        margin: 0;
        padding: 0 6px;
        box-sizing: border-box;
        border-bottom: solid 1px var(--border-color);
        font-size: 0.9em;
        line-height: 32px;

        background: var(--background-plus);
        color: var(--title-color);
      }

      ::content .background {
        position: absolute;
        z-index: 0;
        width: 100%;
      }

      ::content .gfl-item {
        z-index: 10;

        display: flex;
        box-sizing: border-box;
        width: 100%;
        height: 60px;
        padding: 9px 16px;
        border-bottom: solid 1px var(--border-color);
        align-items: center;

        font-size: 18px;
        font-weight: normal;
        font-style: normal;
        list-style-type: none;
        color: var(--text-color);
        background: var(--background);
        -moz-user-select: none;
        text-decoration: none;
      }

      ::content .gfl-item .text {
        flex: 1;
        background: var(--background);
      }

      ::content .gfl-item .image {
        width: 60px;
        height: 60px;
        margin: 0 -16px;
        background: var(--background-minus);
      }

      ::content .gfl-item .image.round {
        width: 42px;
        height: 42px;
        margin: 0 -8px;
        border-radius: 50%;
        overflow: hidden;
      }

      ::content .gfl-item .image > img {
        width: 100%;
        height: 100%;
      }

      ::content h3 {
        margin: 0;
        overflow: hidden;

        font-size: inherit;
        font-weight: 400;
        white-space: nowrap;
        text-overflow: ellipsis;
        background: var(--background);
      }

      ::content p {
        margin: 0;
        font-size: 0.7em;
        line-height: 1.35em;
        background: var(--background);
      }
    </style>`
};

/**
 * Private internals.
 * @param {GaiaFastList} el
 */
function Internal(el) {
  this.container = el.shadowRoot.querySelector('.fast-list');
  this.list = el.shadowRoot.querySelector('ul');
  this.itemContainer = el;
  this.el = el;

  this.configureTemplates();
  debug('config init', this);
}

Internal.prototype = {
  headerHeight: 32,
  itemHeight: 60,

  setModel: function(model) {
    if (!model) return;
    this.model = model;
    this.sections = this.sectionize(model);
    if (!this.fastList) this.createList();
    else this.fastList.reloadData();
  },

  sectionize: function(items) {
    var hash = {};
    if (!this.getSectionName) { return hash; }

    items.forEach(item => {
      var section = this.getSectionName(item);
      if (!section) { return; }
      if (!hash[section]) { hash[section] = []; }
      hash[section].push(item);
    });

    return hash;
  },

  createList: function() {
    this.fastList = new FastList(this);
  },

  configure: function(props) {
    Object.assign(this, props);
  },

  configureTemplates: function() {
    var templateHeader = this.el.querySelector('template[header]');
    var templateItem = this.el.querySelector('template[item]');
    var noTemplates = !templateItem && !templateHeader;

    // If no exact templates found, use unlabeled <template> for item
    if (noTemplates) templateItem = this.el.querySelector('template');

    // Attach template content to the fast-list config
    if (templateHeader) this.templateHeader = templateHeader.innerHTML;
    if (templateItem) this.templateItem = templateItem.innerHTML;
  },

  createItem: function() {
    this.parsedItem = this.parsedItem || poplar.parse(this.templateItem);
    var el = poplar.create(this.parsedItem.cloneNode(true));
    el.classList.add('gfl-item');
    return el;
  },

  createSection: function() {
    this.parsedSection = this.parsedSection || poplar.parse(this.templateHeader);
    var header = poplar.create(this.parsedSection.cloneNode(true));

    var section = document.createElement('section');
    var background = document.createElement('div');

    background.classList.add('background');
    header.classList.add('gfl-header');
    section.appendChild(header);
    section.appendChild(background);

    return section;
  },

  populateItem: function(el, i) {
    poplar.populate(el, this.getRecordAt(i));
  },

  populateSection: function(el, section) {
    var title = el.firstChild;
    var background = title.nextSibling;
    var height = this.getFullSectionHeight(section);

    poplar.populate(title, { section: section });
    background.style.height = height + 'px';
  },

  getViewportHeight: function() {
    debug('get viewport height');
    var bottom = this.el.bottom;
    var top = this.el.top;

    return (top != null && bottom != null)
      ? window.innerHeight - top - bottom
      : this.el.offsetHeight;
  },

  getSections: function() {
    return Object.keys(this.sections || {});
  },

  hasSections: function() {
    return !!this.getSections().length;
  },

  getSectionHeaderHeight: function() {
    return this.hasSections() ? this.headerHeight : 0;
  },

  getFullSectionHeight: function(key) {
    return this.sections[key].length * this.getItemHeight();
  },

  getFullSectionLength: function(key) {
    return this.sections[key].length;
  },

  getRecordAt: function(index) {
    return this.model[index];
  },

  // overwrite to create sections
  getSectionName: function() {},

  getSectionFor: function(index) {
    var item = this.getRecordAt(index);
    return this.getSectionName(item);
  },

  eachSection: function(fn) {
    var sections = this.getSections();
    var result;

    if (sections.length) {
      for (var key in this.sections) {
        result = fn(key, this.sections[key]);
        if (result !== undefined) { return result; }
      }
    } else {
      return fn(null, this.model);
    }
  },

  getIndexAtPosition: function(pos) {
    debug('get index at position', pos);
    var headerHeight = this.getSectionHeaderHeight();
    var itemHeight = this.getItemHeight();
    var fullLength = this.getFullLength();
    var index = 0;

    for (var name in this.sections) {
      var items = this.sections[name];
      var sectionHeight = items.length * itemHeight;

      pos -= headerHeight;

      // If not in this section, jump to next
      if (pos > sectionHeight) {
        pos -= sectionHeight;
        index += items.length;
        continue;
      }

      // Each item in section
      for (var i = 0; i < items.length; i++) {
        pos -= itemHeight;

        if (pos <= 0 || index === fullLength - 1) {
          break; // found it!
        } else {
          index++; // continue
        }
      }
    }

    debug('got index', index);
    return index;
  },

  getPositionForIndex: function(index) {
    debug('get position for index', index);
    var headerHeight = this.getSectionHeaderHeight();
    var itemHeight = this.getItemHeight();
    var sections = this.sections;
    var top = 0;

    for (var name in sections) {
      var items = sections[name];
      top += headerHeight;

      if (index < items.length) {
        top += index * itemHeight;
        break;
      }

      index -= items.length;
      top += items.length * itemHeight;
    }

    debug('got position', top);
    return top;
  },

  getFullLength: function() {
    return this.model.length;
  },

  getItemHeight: function() {
    return this.itemHeight;
  },

  getFullHeight: function() {
    var headers = this.getSections().length * this.getSectionHeaderHeight();
    var items = this.getFullLength() * this.getItemHeight();
    return headers + items;
  },

  insertAtIndex: function(index, record, toSection) {
    this._cachedLength = null;
    return this.eachSection(function(key, items) {
      if (index < items.length || key === toSection) {
        return items.splice(index, 0, record);
      }

      index -= items.length;
    });
  },

  replaceAtIndex: function(index, record) {
    return this.eachSection(function(key, items) {
      if (index < items.length) {
        return items.splice(index, 1, record);
      }

      index -= items.length;
    });
  },

  removeAtIndex: function(index) {
    this._cachedLength = null;
    return this.eachSection(function(key, items) {
      if (index < items.length) {
        return items.splice(index, 1)[0];
      }

      index -= items.length;
    });
  },

  // Default header template overridden by
  // <template header> inside <gaia-fast-list>
  templateHeader: '<h2>${section}</h2>',

  // Default item template overridden by
  // <template item> inside <gaia-fast-list>
  templateItem: '<a href="${link}"><div class="text"><h3>${title}</h3>' +
    '<p>${body}</p></div><div class="image"><img src="${image}"/></div></a>'
};

/**
 * Exports
 */

module.exports = component.register('gaia-fast-list', GaiaFastListProto);

});})(typeof define=='function'&&define.amd?define
:(function(n,w){'use strict';return typeof module=='object'?function(c){
c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){
return w[n];},m.exports,m);w[n]=m.exports;};})('GaiaFastList',this));