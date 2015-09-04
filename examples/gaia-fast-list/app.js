'use strict';

var debug = 0 ? (...args) => console.log('[GaiaFastListDemo]', ...args) : () => {};
var list = document.querySelector('gaia-fast-list');

// Defining getSectionName creates sections
list.configure({
  getSectionName: item => item.date
});

var chunkSize = 100;
var total = 350;
var count = 0;

function loadNext() {
  getDataAsync(count, chunkSize).then(data => {
    debug('got data', data);
    var model = list.model || [];
    list.model = model.concat(data);
    count += chunkSize;

    if (count < total) {
      loadNext();
    }
  });
}

// Keeping this function around for manual testing
function getDataSync(from, limit) {
  debug('get data async', from, limit);
  return new Promise(resolve => {
    var to = Math.min(from + limit, total);
    var date = Date.now();
    var result = [];

    for (var i = from; i < to; i++) {
      result.push({
        title: `Title ${i}`,
        metadata: { body: `Body ${i}` },
        image: 'image.jpg',
        date: date
      });
    }

    resolve(result);
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
          metadata: { body: `Body ${i}` },
          image: 'image.jpg',
          date: date
        });
      }

      resolve(result);
    }, 1000);
  });
}

// Init!
loadNext();
