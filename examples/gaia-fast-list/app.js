'use strict';

var debug = 0 ? (...args) => console.log('[GaiaFastListDemo]', ...args) : ()=>{};

var list = document.querySelector('gaia-fast-list');

list.configure({
  getSectionName: item => {
    return item.date;
  },

  itemKeys: {
    title: 'title',
    body: 'metadata.body',
    image: 'image',
    link: 'link'
  },
});

var chunkSize = 100;
var total = 350;
var count = 0;

function loadNext() {
  getDataAsync(count, chunkSize).then(data => {
    debug('got data', data);
    list.model = list.model.concat(data);
    count += chunkSize;

    if (count < total) {
      loadNext();
    }
  });
}

function getDataAsync(from, limit) {
  debug('get data async', from, limit);
  return new Promise(resolve => {
    setTimeout(() => {
      var to = Math.min(from + limit, total);
      var date = Date.now();
      var result = [];

      for (var i = from; i < to; i++) {
        result.push({
          title: `Title ${i}`,
          metadata: {
            body: `Body ${i}`
          },
          date: date
        });
      }

      resolve(result);
    }, 500);
  });
}

// Init!
loadNext();
