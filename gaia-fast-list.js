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
 * Exports
 */

module.exports = component.register('gaia-fast-list', {
  created: function() {
    this.setupShadowRoot();

    this.els = {
      fastList: this.shadowRoot.querySelector('.fast-list'),
      ul: this.shadowRoot.querySelector('ul')
    };

    this.userConfig = {
      container: this.els.fastList,
      list: this.els.ul,
      itemContainer: this,
      _itemHeight: 60,
      _headerHeight: 32
    };

    this.configureTemplates();
    debug('created', this.userConfig);
  },

  configureTemplates: function() {
    var templateHeader = this.querySelector('template[header]');
    var templateItem = this.querySelector('template[item]');
    var noTemplates = !templateItem && !templateHeader;
    var config = this.userConfig;

    // If no exact templates found, use unlabeled <template> for item
    if (noTemplates) templateItem = this.querySelector('template');

    // Attach template content to the fast-list config
    if (templateHeader) config.templateHeader = templateHeader.innerHTML;
    if (templateItem) config.templateItem = templateItem.innerHTML;
  },

  _createList: function() {
    if (this._list) return;
    this._config = new Configuration(this.userConfig);
    this._list = new FastList(this._config);
  },

  configure: function(config) {
    Object.assign(this.userConfig, config);
  },

  attrs: {
    model: {
      get: function() { return this._config && this._config.model; },
      set: function(value) {
        this._createList();
        this._config.setModel(value);
        this._list.reloadData();
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

        background: linear-gradient(
          to top,
          var(--border-color),
          var(--border-color) 1px,
          transparent 1px,
          transparent);

        background-position: 0 -60px;
        background-size: 100% 60px;
        background-repeat: repeat-y;
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
        -moz-user-select: none;
        text-decoration: none;
      }

      ::content .gfl-item .text {
        flex: 1;
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
      }

      ::content p {
        margin: 0;
        font-size: 0.7em;
        line-height: 1.35em;
      }
    </style>`
});

function Configuration(config) {
  Object.assign(this, config);
  this.container = config.container;
  this.setModel(config.model || []);
  debug('config init', this);
}

Configuration.prototype = {

  // Default header template overridden by
  // <template header> inside <gaia-fast-list>
  templateHeader: '<h2>${section}</h2>',

  // Default item template overridden by
  // <template item> inside <gaia-fast-list>
  templateItem: '<a href="${link}"><div class="text"><h3>${title}</h3>' +
    '<p>${body}</p></div><div class="image"><img src="${image}"/></div></a>',

  setModel: function(model) {
    this.model = model;
    this.sections = this.sectionize(this.model);
  },

  sectionize: function(data) {
    var hash = {};

    if (!this.getSectionName) { return hash; }

    data.forEach(item => {
      var section = this.getSectionName(item);
      if (!section) { return; }
      if (!hash[section]) { hash[section] = []; }
      hash[section].push(item);
    });

    return hash;
  },

  createItem: function() {
    var el = poplar(this.templateItem);
    el.classList.add('gfl-item');
    return el;
  },

  createSection: function() {
    var section = document.createElement('section');
    var background = document.createElement('div');
    var header = poplar(this.templateHeader);

    background.classList.add('background');
    header.classList.add('gfl-header');
    section.appendChild(header);
    section.appendChild(background);

    return section;
  },

  populateItem: function(el, i) {
    debug('populate item');
    poplar.populate(el, this.getRecordAt(i));
  },

  populateSection: function(el, section) {
    debug('populate section', section);

    var title = el.firstChild;
    var background = title.nextSibling;
    var height = this.fullSectionHeight(section);

    poplar.populate(title, { section: section });
    background.style.height = height + 'px';
  },

  getSections: function() {
    return Object.keys(this.sections || {});
  },

  hasSections: function() {
    return !!this.getSections().length;
  },

  sectionHeaderHeight: function() {
    return this.hasSections() ? this._headerHeight : 0;
  },

  fullSectionHeight: function(key) {
    return this.sections[key].length * this.itemHeight();
  },

  fullSectionLength: function(key) {
    return this.sections[key].length;
  },

  getRecordAt: function(index) {
    return this.model[index];
  },

  getSectionFor: function(index) {
    var item = this.getRecordAt(index);
    var section = this.getSectionName && this.getSectionName(item);
    return section;
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

  indexAtPosition: function(pos) {
    debug('index at position', pos);
    var headerHeight = this.sectionHeaderHeight();
    var itemHeight = this.itemHeight();
    var fullLength = this.fullLength();
    var index = 0;

    this.eachSection(function(key, items) {
      pos -= headerHeight;
      var sectionHeight = items.length * itemHeight;

      // If not in this section, jump to next
      if (pos > sectionHeight) {
        pos -= sectionHeight;
        index += items.length;
        return;
      }

      // Each item in section
      for (var i = 0; i < items.length; i++) {
        pos -= itemHeight;

        if (pos <= 0 || index === fullLength - 1) {
          return index; // found it!
        } else {
          index++; // continue
        }
      }
    });

    debug('got index', index);
    return index;
  },

  positionForIndex: function(index) {
    debug('position for index', index);
    var headerHeight = this.sectionHeaderHeight();
    var itemHeight = this.itemHeight();
    var top = 0;

    this.eachSection(function(key, items) {
      top += headerHeight;

      if (index < items.length) {
        top += index * itemHeight;
        return top;
      }

      index -= items.length;
      top += items.length * itemHeight;
    });

    debug('got position', top);
    return top;
  },

  fullLength: function() {
    return this.model.length;
  },

  itemHeight: function() {
    return this._itemHeight;
  },

  fullHeight: function() {
    var headers = this.getSections().length * this.sectionHeaderHeight();
    var items = this.fullLength() * this.itemHeight();
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
  }
};

});})(typeof define=='function'&&define.amd?define
:(function(n,w){'use strict';return typeof module=='object'?function(c){
c(require,exports,module);}:function(c){var m={exports:{}};c(function(n){
return w[n];},m.exports,m);w[n]=m.exports;};})('GaiaFastList',this));