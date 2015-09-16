/*global FastList*/
'use strict';

var debug = 0 ? (...args) => console.log('[DataSource]', ...args) : ()=>{};

var content = document.getElementById('content');
var data = createDummyData(1000);
var itemHeight = 88;

var list = new FastList({
  container: content,

  createItem: function() {
    var section = document.createElement('li');
    section.innerHTML = '<h3> </h3><p> </p><div><img /></div>';
    return section;
  },

  createSection: function() {
    var section = document.createElement('section');
    section.innerHTML = '<h2> </h2><div class="background"></div>';
    return section;
  },

  populateItem: function(el, i) {
    debug('populate item', el);
    var title = el.firstChild;
    var body = title.nextSibling;
    var record = this.getRecordAt(i);

    title.firstChild.data = record.name;
    body.firstChild.data = record.metadata.artist;
  },

  populateItemDetail: function(el, i) {
    var img = el.querySelector('img');
    img.src = makeImage(i);
    img.onload = function() {
      img.classList.add('loaded');
    };
  },

  unpopulateItemDetail: function(el) {
    var img = el.querySelector('img');
    img.classList.remove('loaded');
    img.removeAttribute('src');
  },

  populateSection: function(el, section, i) {
    var title = el.firstChild;
    var height = this.getFullSectionHeight(section);
    var background = title.nextSibling;

    background.style.height = height + 'px';
    title.firstChild.data = section;
  },

  getSections() {
    debug('get sections');
    return [];
  },

  getSectionHeaderHeight() {
    return 0;
  },

  getFullSectionHeight() {
    var result = data.length * itemHeight;
    debug('full section height', result);
    return result;
  },

  getFullSectionLength() {
    var result = data.length;
    debug('full section length', result);
    return result;
  },

  getSectionFor() {
    return '';
  },

  getRecordAt: function(index) {
    return data[index];
  },

  getIndexAtPosition: function(pos) {
    return Math.floor(pos / itemHeight);
  },

  getPositionForIndex: function(index) {
    return index * itemHeight;
  },

  getFullLength: function() {
    return data.length;
  },

  getItemHeight: function() {
    return itemHeight;
  },

  getFullHeight: function() {
    return data.length * itemHeight;
  },

  insertAtIndex: function(index, record, toSection) {
    return data.splice(index, 0, record);
  },

  replaceAtIndex: function(index, record) {
    return data.splice(index, 1)[0];
  }
});


function createDummyData(count) {
  var result = [];

  for (var i = 0; i < count; i++) {
    result.push({
      name: 'Song ' + i,
      metadata: {
        title: 'Song title ' + i,
        artist: 'Song artist ' + i
      }
    });
  }

  return result;
}

// Crappy and hopefully expensive canvas code
function makeImage(index) {
  var canvas = document.createElement('canvas');
  canvas.width = canvas.height = 176;
  var ctx = canvas.getContext('2d');
  ctx.font = '72px sans-serif';
  var width = ctx.measureText(index).width
  var height = ctx.measureText(index).height
  var top = 52;
  var left = (176 - width) / 2;
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#000'
  ctx.fillText(index, left - 6, top);
  ctx.fillStyle = 'red'
  ctx.fillText(index, left, top);
  ctx.fillStyle = 'cyan'
  ctx.fillText(index, left + 6, top);
  return canvas.toDataURL('image/png');
}
