/* global suite, sinon, setup, teardown, test, assert,
          DataSource, FastList */

suite('FastList >', function() {
  'use strict';

  var fakeDoc, container, source;

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

  var scheduler = FastList.scheduler;

  setup(function() {
    sinon.stub(scheduler, 'attachDirect');
    sinon.stub(scheduler, 'mutation');

    fakeDoc = document.createElement('div');
    container = document.createElement('div');
    fakeDoc.appendChild(container);
    document.body.appendChild(fakeDoc);

    container.style.width = '320px';
    container.style.height = '480px';

    // 1000 items
    // 64px height
    // 7.5 items per screen
    var data = createDummyData(1000);
    source = new DataSource(data);
    source.container = container;
  });

  teardown(function() {
    scheduler.attachDirect.restore();
    scheduler.mutation.restore();
    fakeDoc.remove();
  });

  function assertCurrentlyRenderedWindow(from, to) {
    var displayedIndices = [];
    var items = container.querySelectorAll('ul li');

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var index = parseInt(item.dataset.index);
      displayedIndices.push(index);

      // Content
      var expectedContent = source.getRecordAt(index);
      assert.include(item.textContent, expectedContent.title);
      assert.include(item.textContent, expectedContent.body);

      // Position
      var expectedPosition = source.positionForIndex(index);
      assert.equal(item.style.transform,
                   'translate3d(0px, ' + expectedPosition + 'px, 0px)');
    }

    displayedIndices.sort(function(a, b) {
      return a - b;
    });

    assert.equal(displayedIndices[0], from);
    assert.equal(displayedIndices[displayedIndices.length - 1], to);
    assert.equal(displayedIndices.length, to - from + 1);
  }

  suite('FastList() constructor', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
    });

    test('it sets the required styles on the container', function() {
      assert.equal(container.style.overflowX, 'hidden');
      assert.equal(container.style.overflowY, 'scroll');
    });

    test('it attaches a direct block to the scroll event', function() {
      sinon.assert.calledOnce(scheduler.attachDirect);
      sinon.assert.calledWith(scheduler.attachDirect, container, 'scroll');
    });

    suite('> after a scheduler mutation flush', function() {
      setup(function() {
        scheduler.mutation.yield();
      });

      test('it sets the required styles on the list items', function() {
        var items = container.querySelectorAll('ul li');
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          assert.equal(item.style.position, 'absolute');
          assert.equal(item.style.left, '0px');
          assert.equal(item.style.top, '0px');
          assert.equal(item.style.overflow, 'hidden');
          assert.equal(item.style.willChange, 'transform');
        }
      });

      test('it renders the section headers', function() {
        assert.equal(container.querySelectorAll('ul section h2').length, 1);
      });

      test('it sets the height of sections', function() {
        var height = container.querySelector('ul section').style.height;
        assert.equal(height, '64000px');
      });

      test('the list is high enough to natively scroll', function() {
        assert.equal(container.querySelector('ul').offsetHeight, 64000);
      });

      test('it renders a whole prerendered viewport of list items', function() {
        // 7.5 per screen * 2.8 (will-change budget) -> 21
        assert.equal(container.querySelectorAll('ul li').length, 21);
      });

      test('it renders the correct content', function() {
        assertCurrentlyRenderedWindow(0, 20);
      });
    });
  });

  suite('Scrolling >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      scheduler.mutation.yield();

      container.scrollTop = 1200; // 2.5 viewports
      scheduler.attachDirect.yield();
    });

    test('it updates the rendering', function() {
      assertCurrentlyRenderedWindow(15, 35);
    });

    suite('really fast >', function() {
      setup(function() {
        container.scrollTop += 1200; // 2.5 viewports
        scheduler.attachDirect.yield();
      });

      test('it does not render anything new', function() {
        assertCurrentlyRenderedWindow(15, 35);
      });

      suite('multiple times >', function() {
        setup(function() {
          container.scrollTop += 480; // 1 viewport
          scheduler.attachDirect.yield();
        });

        test('it still skips rendering', function() {
          assertCurrentlyRenderedWindow(15, 35);
        });

        suite('then slowing down down >', function() {
          setup(function() {
            container.scrollTop += 239; // 1/2 viewport
            scheduler.attachDirect.yield();
          });

          test('it catches up', function() {
            assertCurrentlyRenderedWindow(45, 65);
          });
        });
      });
    });

    suite('upward >', function() {
      setup(function() {
        container.scrollTop -= 176; // 2 items
        scheduler.attachDirect.yield();
      });

      test('it prerenders in the correct direction', function() {
        assertCurrentlyRenderedWindow(6, 26);
      });
    });
  });

  suite('FastList#scrollInstantly(by) >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      scheduler.mutation.yield();

      fastList.scrollInstantly(1200);
    });

    test('it updates the rendering directly', function() {
      assertCurrentlyRenderedWindow(15, 35);
    });
  });

  suite('FastList#reloadData() >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      scheduler.mutation.yield();

      container.scrollTop = 1200;
      scheduler.attachDirect.yield();

      source.items[16].title = 'Totally new title';
      source.items.push({
        title: 'Totally new title',
        body: 'Totally new body'
      });
      fastList.reloadData();
      scheduler.mutation.yield();
    });

    test('it keeps the scrolling position', function() {
      assert.equal(container.scrollTop, 1200);
    });

    test('it updates the height of sections', function() {
      var height = container.querySelector('ul section').style.height;
      assert.equal(height, '64064px');
    });

    test('the list is still high enough to natively scroll', function() {
      assert.equal(container.querySelector('ul').offsetHeight, 64064);
    });

    test('it renders the updated content', function() {
      assert.include(container.textContent, 'Totally new title');
      assertCurrentlyRenderedWindow(15, 35);
    });
  });

  suite('Clicking an item', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      scheduler.mutation.yield();
    });

    test('it dispatches a CustomEvent', function(done) {
      container.addEventListener('item-selected', function wait(evt) {
        container.removeEventListener('item-selected', wait);

        assert.equal(evt.detail.index, '0');
        assert.equal(evt.detail.clickEvt, clickEvt);
        done();
      });

      var item = container.querySelector('ul li');
      var clickEvt = new CustomEvent('click', {
        bubbles: true
      });
      item.dispatchEvent(clickEvt);
    });
  });

  suite('Scrolling back to top >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      scheduler.mutation.yield();

      container.scrollTop = 1200;
      scheduler.attachDirect.yield();
    });

    test('it dispatches a CustomEvent', function(done) {
      container.addEventListener('top-reached', function wait(evt) {
        container.removeEventListener('top-reached', wait);
        done();
      });

      container.scrollTop = 0;
      scheduler.attachDirect.yield();
    });
  });
});
