var myList = new FastList({
  container: document.querySelector('section'),

  itemTemplate: '<li><h3> </h3><p> </p></li>',
  sectionTemplate: '<section><h2> </h2><div class="background"></div></section>',

  populateItem: function(el, i) {
    var title = el.firstChild;
    var body = title.nextSibling;
    var record = this.getRecordAt(i);

    title.firstChild.data = record.title;
    body.firstChild.data = record.body;
  },

  populateSection: function(el, section, i) {
    var title = el.firstChild;
    var height = this.fullSectionHeight(section);
    var background = title.nextSibling;

    background.style.height = height + 'px';
    title.firstChild.data = section;
  },

  getSections() {
    debug('get sections');
    return [];
  },

  sectionHeaderHeight() {
    return 0;
  },

  fullSectionHeight() {
    var result = model.length * itemHeight;
    debug('full section height', result);
    return result;
  },

  fullSectionLength() {
    var result = model.length;
    debug('full section length', result);
    return result;
  },

  getSectionFor() {
    return '';
  },

  getRecordAt: function(index) {
    return model[index];
  },

  indexAtPosition: function(pos) {
    return Math.floor(pos / itemHeight);
  },

  positionForIndex: function(index) {
    return index * itemHeight;
  },

  fullLength: function() {
    return model.length;
  },

  itemHeight: function() {
    return itemHeight;
  },

  fullHeight: function() {
    return model.length * itemHeight;
  },

  insertAtIndex: function(index, record, toSection) {
    return model.splice(index, 0, record);
  },

  replaceAtIndex: function(index, record) {
    return model.splice(index, 1)[0];
  }
});