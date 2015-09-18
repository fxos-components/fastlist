/* global assert */
/* exported createDummyData, assertCurrentlyRenderedWindow, MockPromise */

/**
 * Generates fake data for a fake data source
 *
 * @param {Number} count the number of items
 * @return {Array} the data
 */
function createDummyData(count) {
  var result = [];

  for (var i = 0; i < count; i++) {
    result.push({
      title: 'Title ' + i,
      body: 'Body ' + i,
    });
  }

  return result;
}


/**
 * Assert the contents currently rendered on screen
 *
 * @param rendering
 * @param {DOMElement} rendering.container the list container to querySelector
 * @param {DataSource} rendering.source the DataSource to compare against
 * @param {Number} rendering.from the index of the first item rendered
 * @param {Number} rendering.to the index of the last item rendred
 * @param {Bool} rendering.expectsDetail optional detail rendering check
 * @param {Bool} rendering.expectsNoDetail optional detail rendering check
 */
function assertCurrentlyRenderedWindow(rendering) {
  var displayedIndices = [];
  var items = rendering.container.querySelectorAll('ul li');

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var index = parseInt(item.dataset.index);
    displayedIndices.push(index);

    // Content
    var expectedContent = rendering.source.getRecordAt(index);
    assert.include(item.textContent, expectedContent.title);
    assert.include(item.textContent, expectedContent.body);

    // Position
    var expectedPosition = rendering.source.getPositionForIndex(index);
    assert.equal(item.style.transform,
                 'translate3d(0px, ' + expectedPosition + 'px, 0px)');

     // Detail rendering
    var img = item.querySelector('img');
    if (rendering.expectsDetail) {
      var expectedURL = '#' + index + '.png';
      assert.include(img.src, expectedURL);
    } else if (rendering.expectsNoDetail) {
      assert.notOk(img.src);
    }
  }

  displayedIndices.sort(function(a, b) {
    return a - b;
  });

  assert.equal(displayedIndices[0], rendering.from);
  assert.equal(displayedIndices[displayedIndices.length - 1], rendering.to);
  assert.equal(displayedIndices.length, rendering.to - rendering.from + 1);
}

var MockPromise = function() {
  this.promise = new Promise(function(resolve, reject) {
    this.resolve = resolve;
    this.reject = reject;
  }.bind(this));
};
