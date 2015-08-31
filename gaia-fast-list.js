;(function(define){'use strict';define(function(require,exports,module){

/**
 * Dependencies
 */

var component = require('gaia-component');
var FastList = require('fast-list');
var scheduler = FastList.scheduler;
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
    debug('create');
    this.setupShadowRoot();
    this.top = this.getAttribute('top');
    this.bottom = this.getAttribute('bottom');
    this.caching = this.getAttribute('caching');
    this.offset = this.getAttribute('offset');
    this[internal] = new Internal(this);
    debug('created');
  },

  configure: function(props) {
    debug('configure');
    this[internal].configure(props);
  },

  complete: function() {
    if (!this.caching) return;

    this[internal].cachedHeight = null;
    this[internal].updateCachedHeight();
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
    },

    caching: {
      get() { return this._caching; },
      set(value) {
        value = value || value === '';
        if (value === this._caching) return;
        if (value) this.setAttribute('caching', '');
        else this.removeAttribute('caching');
        this._caching = value;
      }
    },

    offset: {
      get() { return this._offset || 0; },
      set(value) {
        if (value == this._offset) return;
        if (value) this.setAttribute('offset', value);
        else this.removeAttribute('offset');
        this._offset = Number(value);
      }
    },

    scrollTop: {
      get() { return this[internal].fastList.scrollTop; },
      set(value) {
        if (this[internal].fastList) this[internal].container.scrollTop = value;
        else this[internal].initialScrollTop = value;
      }
    },

    minScrollHeight: {
      get() { return this[internal].list.style.minHeight; },
      set(value) { this[internal].list.style.minHeight = value; }
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
        overflow: hidden;
      }

      .fast-list {
        position: absolute;
        left: 0; top: 0;
        height: 100%;
        width: 100%;
        overflow: hidden !important;
      }

      .fast-list.layerize {
        overflow-y: scroll !important;
      }

      .fast-list.empty {
        background: repeating-linear-gradient(
          0deg,
          var(--background) 0px,
          var(--background) 59px,
          var(--border-color) 60px,
          var(--border-color) 60px);
        background-position: 0 1px;
      }

      .fast-list ul {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .fast-list.empty:before {
        content: '';
        position: sticky;
        position: -webkit-sticky;
        top: 0px;
        height: 32px;
        z-index: 100;

        display: block;

        background: var(--background-plus);
        color: var(--title-color);
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
        will-change: initial !important;
      }

      :host(.layerize) ::content .gfl-item {
        will-change: transform !important;
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
  this.el = el;
  this.items = this.injectItemsFromCache();
  this.container = el.shadowRoot.querySelector('.fast-list');
  this.list = el.shadowRoot.querySelector('ul');
  this.itemContainer = el;
  this.configureTemplates();
  this.setEmpty(!this.cacheRendered);
  debug('config init', this);
}

Internal.prototype = {
  headerHeight: 32,
  itemHeight: 60,

  setModel: function(model) {
    debug('set model', model);
    if (!model) return;
    this.model = model;
    this.sections = this.sectionize(model);
    if (!this.fastList) this.createList();
    else this.fastList.reloadData();
    this.setEmpty(false);
  },

  setEmpty: function(value) {
    this.container.classList.toggle('empty', value);
  },

  sectionize: function(items) {
    debug('sectionize', items);
    if (!this.getSectionName) return;
    var hash = {};

    for (var i = 0, l = items.length; i < l; i++) {
      var section = this.getSectionName(items[i]);
      if (!section) { return; }
      if (!hash[section]) { hash[section] = []; }
      hash[section].push(items[i]);
    }

    return hash;
  },

  createList: function() {
    debug('create list');
    this.fastList = new FastList(this);
    setTimeout(() => this.layerize(), 360);
    this.updateCache();
  },

  layerize: function() {
    this.el.classList.add('layerize');
    this.container.classList.add('layerize');
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

    if (templateHeader) {
      this.templateHeader = templateHeader.innerHTML;
      templateHeader.remove();
    }

    if (templateItem) {
      this.templateItem = templateItem.innerHTML;
      templateItem.remove();
    }
  },

  createItem: function() {
    debug('create item');
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
    section.classList.add('gfl-section');

    return section;
  },

  /**
   * Populates a list-item with data.
   *
   * If items were inflated from the HTML cache
   * they won't yet be poplar elements; in
   * which case we have to replace them
   * before we can populate them with data.
   *
   * @param  {HTMLElement} el
   * @param  {Number} i
   */
  populateItem: function(el, i) {
    var record = this.getRecordAt(i);
    var successful = poplar.populate(el, record);

    if (!successful) {
      debug('not a poplar element');
      var replacement = this.fastList.createItem();
      this.fastList.replaceChild(replacement, el);
      this.populateItem(replacement, i);
    }
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
  // IDEA: We could accept an Object
  // as a model and use the keys as
  // section names. This would probably
  // require the user do some additional
  // formatting before setting the model.
  getSectionName: undefined,

  getSectionFor: function(index) {
    var item = this.getRecordAt(index);
    return this.getSectionName && this.getSectionName(item);
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
    // debug('get index at position', pos);
    var sections = this.sections || [this.model];
    var headerHeight = this.getSectionHeaderHeight();
    var itemHeight = this.getItemHeight();
    var fullLength = this.getFullLength();
    var index = 0;

    pos += this.el.offset;

    for (var name in sections) {
      var items = sections[name];
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

    // debug('got index', index);
    return index;
  },

  getPositionForIndex: function(index) {
    // debug('get position for index', index);
    var sections = this.sections || [this.model];
    var headerHeight = this.getSectionHeaderHeight();
    var itemHeight = this.getItemHeight();
    var top = this.el.offset;

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

    // debug('got position', top);
    return top;
  },

  getFullLength: function() {
    return this.model.length;
  },

  getItemHeight: function() {
    return this.itemHeight;
  },

  getFullHeight: function() {
    var height = this.cachedHeight;
    if (height != null) return height;

    var headers = this.getSections().length * this.getSectionHeaderHeight();
    var items = this.getFullLength() * this.getItemHeight();
    return headers + items + this.el.offset;
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

  getCacheKey: function() {
    return `${this.el.tagName}:${this.el.id}:${location}`;
  },

  getCachedHeightKey: function() {
    return `${this.el.tagName}:${this.el.id}:${location}:height`;
  },

  /**
   * Gets the currently rendered list-item and section
   * HTML and then persists it to localStorage later
   * in time to prevent blocking the remaining
   * fast-list setup.
   *
   * The scheduler.mutation() block means that
   * it won't interupt user scrolling.
   */
  updateCache: function() {
    if (!this.el.caching) return;
    var items = this.el.querySelectorAll('.gfl-item, .gfl-section');
    var html = [].map.call(items, el => el.outerHTML).join('');

    setTimeout(() => {
      scheduler.mutation(() => {
        localStorage.setItem(this.getCacheKey(), html);
      });
    }, 500);
  },

  updateCachedHeight: function() {
    if (!this.el.caching) return;
    var height = this.getFullHeight();

    setTimeout(() => {
      scheduler.mutation(() => {
        localStorage.setItem(this.getCachedHeightKey(), height);
      });
    }, 500);
  },

  injectItemsFromCache: function() {
    if (!this.el.caching) return;
    debug('injecting items from cache');

    var height = localStorage.getItem(this.getCachedHeightKey());
    if (height) {
      this.cachedHeight = height;
    }

    var html = localStorage.getItem(this.getCacheKey());
    if (html) {
      this.el.insertAdjacentHTML('beforeend', html);
      this.cacheRendered = true;
      return [].slice.call(this.el.querySelectorAll('.gfl-item'));
    }
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