(function(exports) {
  'use strict';

  var itemHeight = 64;

  exports.DataSource = function DataSource(items) {
    this.items = items;
  };

  exports.DataSource.prototype = {
    createItem: function() {
      var section = document.createElement('li');
      section.innerHTML = '<h3> </h3><p> </p><div class="overlay">' +
      '<div class="cursor"></div></div>';
      return section;
    },

    createSection: function() {
      var section = document.createElement('section');
      section.innerHTML = '<h2> </h2><div class="background"></div>';
      return section;
    },

    populateItem: function(item, i) {
      var title = item.querySelector('h3');
      var body = item.querySelector('p');
      var record = this.getRecordAt(i);

      title.textContent = record.title;
      body.textContent = record.body;
    },

    populateSection: function(el, section, i) {
      var title = el.firstChild;
      var height = this.getFullSectionHeight(section);
      var background = title.nextSibling;

      background.style.height = height + 'px';
      title.firstChild.data = section;
    },

    getSections: function() {
      return ['Section Name'];
    },

    getSectionHeaderHeight: function() {
      return 0;
    },

    getFullSectionHeight: function() {
      var result = this.items.length * itemHeight;
      return result;
    },

    getFullSectionLength: function() {
      var result = this.items.length;
      return result;
    },

    getSectionFor: function() {
      return 'Section Name';
    },

    getRecordAt: function(index) {
      return this.items[index];
    },

    getIndexAtPosition: function(pos) {
      return Math.floor(pos / itemHeight);
    },

    getPositionForIndex: function(index) {
      return index * itemHeight;
    },

    getFullLength: function() {
      return this.items.length;
    },

    getItemHeight: function() {
      return itemHeight;
    },

    getFullHeight: function() {
      this.items.length * itemHeight;
    },

    insertAtIndex: function(index, record, toSection) {
      return this.items.splice(index, 0, record);
    },

    removeAtIndex: function(index, record) {
      return this.items.splice(index, 1)[0];
    }
  };
})(window);
