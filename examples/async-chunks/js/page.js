
  /*global FastList*/

  'use strict';

  var debug = 0 ? console.log.bind(console, '[AsyncDemo]') : function() {};
  var itemHeight = 88;
  var lastRecord = 0;
  var chunkSize = 100;
  var model = [];

  var db = {
    length: 1000,

    get: function(from, limit) {
      debug('get', from, limit);
      return new Promise(function(resolve) {
        setTimeout(function() {
          var to = from + limit;
          var date = Date.now();
          var result = [];

          while (from++ < to) {
            result.push({
              title: 'Item ' + from,
              body: 'Body for item ' + from,
              date: date
            });
          }

          resolve(result);
        }, 1000);
      });
    }
  };

  var myList = new FastList({
    container: document.querySelector('section'),

    itemTemplate: '<li><h3> </h3><p> </p></li>',
    sectionTemplate: '<section><h2> </h2><div class="background"></div></section>',

    populateItem: function(el, i) {
      var title = el.firstChild;
      var body = title.nextSibling;
      var record = this.getRecordAt(i);

      title.firstChild.data = record ? record.title : '';
      body.firstChild.data = record ? record.body : '';
    },

    populateSection: function(el, section, i) {
      debug('populate section', section);
      var title = el.firstChild;
      var height = this.fullSectionHeight(section);
      var background = title.nextSibling;

      background.style.height = height + 'px';
      title.firstChild.data = section;
    },

    getSections: function() {
      this.sections = {};

      model.forEach(model => {
        this.sections[model.date] = this.sections[model.date] || [];
        this.sections[model.date].push(model);
      });

      return Object.keys(this.sections);
    },

    sectionHeaderHeight: function() {
      return 32;
    },

    fullSectionHeight: function(key) {
      return this.sections[key].length * this.itemHeight();
    },

    getSectionFor: function(index) {
      return model[index].date;
    },

    getRecordAt: function(index) {
      return model[index];
    },

    indexAtPosition: function(pos) {
      var index = 0;

      for (var key in this.sections) {
        pos -= this.sectionHeaderHeight();
        var sectionHeight = this.sections[key].length * this.itemHeight();

        if (pos > sectionHeight) {
          pos -= sectionHeight;
          index += this.sections[key].length;
          continue;
        }

        for (var i = 0; i < this.sections[key].length; i++) {
          pos -= itemHeight;
          index++;
          if (pos <= 0 || index === this.fullLength() - 1) {
            return index;
          }
        }
      }
    },

    positionForIndex: function(index) {
      var top = 0;

      for (var key in this.sections) {
        top += this.sectionHeaderHeight();

        if (index < this.sections[key].length) {
          top += index * itemHeight;
          return top;
        }

        index -= this.sections[key].length;
        top += this.sections[key].length * itemHeight;
      }
    },

    fullLength: function() {
      return model.length;
    },

    itemHeight: function() {
      return itemHeight;
    },

    fullHeight: function() {
      var height = 0;
      for (var key in this.sections) {
        height += this.sectionHeaderHeight() + this.sections[key].length * itemHeight;
      }
      return height;
    },

    insertAtIndex: function(index, record, toSection) {
      return model.splice(index, 0, record);
    },

    replaceAtIndex: function(index, record) {
      return model.splice(index, 1)[0];
    }
  });

  function fetchNextChunk() {
    return db.get(lastRecord, chunkSize).then(function(batch) {
      debug('got chunk', batch);
      model.push.apply(model, batch);
      lastRecord += chunkSize;
      myList.reloadData();
    });
  }

  fetchNextChunk().then(function check() {
    if (lastRecord < db.length) {
      fetchNextChunk().then(check);
    }
  });

