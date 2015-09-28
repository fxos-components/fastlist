/* global suite, sinon, setup, teardown, test, assert,
   DataSource, FastList, assertRenderedViewport,
   createDummyData, assertCurrentlyRenderedWindow, MockPromise */

suite('FastList >', function() {
  'use strict';

  var fakeDoc, container, source;

  var scheduler = FastList.scheduler;

  setup(function() {
    this.sinon = sinon.sandbox.create();
    this.sinon.stub(scheduler, 'attachDirect');
    this.sinon.stub(scheduler, 'detachDirect');
    this.sinon.stub(scheduler, 'mutation');

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
    this.sinon.restore();
    fakeDoc.remove();
  });

  suite('FastList() constructor', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
    });

    test('it sets the required styles on the container', function() {
      assert.equal(container.style.overflowX, 'hidden');
      assert.equal(container.style.overflowY, 'scroll');
    });

    test('it sets the required styles on the list', function() {
      var list = container.querySelector('ul');
      assert.equal(list.style.overflow, 'hidden');
    });

    suite('> after a scheduler mutation flush', function() {
      setup(function() {
        scheduler.mutation.yield();
      });

      test('it attaches a direct block to the scroll event', function() {
        sinon.assert.calledOnce(scheduler.attachDirect);
        sinon.assert.calledWith(scheduler.attachDirect, container, 'scroll');
      });

      test('it calls source.getViewportHeight() if provided', function() {
        source.getViewportHeight = sinon.stub();
        source.getViewportHeight.returns(400);
        fastList = new FastList(source);
        scheduler.mutation.yield();
        sinon.assert.called(source.getViewportHeight);
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
        // 7.5 per screen * 2.7 (will-change budget) -> 20
        assert.equal(container.querySelectorAll('ul li').length, 20);
      });

      test('it renders the correct content', function() {
        assertCurrentlyRenderedWindow({
          container: container,
          source: source,
          from: 0,
          to: 19
        });
      });

      suite('when the model becomes tiny >', function() {
        setup(function() {
          var tinyData = createDummyData(3);
          source.data = tinyData;
          fastList.reloadData();
          scheduler.mutation.yield();
        });

        test('the list is resized', function() {
          assert.equal(container.querySelector('ul').offsetHeight, 192);
        });

        test('unused items are hidden', function() {
          var selector = 'ul li:not([data-populated="false"])';
          assert.equal(container.querySelectorAll(selector).length, 3);
        });

        test('it renders the correct content', function() {
          assertCurrentlyRenderedWindow({
            container: container,
            source: source,
            from: 0,
            to: 2
          });
        });
      });

      suite('then grows back', function() {
        setup(function() {
          var bigData = createDummyData(1000);
          source.data = bigData;
          fastList.reloadData();
          scheduler.mutation.yield();
        });

        test('it renders the correct content', function() {
          assertCurrentlyRenderedWindow({
            container: container,
            source: source,
            from: 0,
            to: 19
          });
        });
      });
    });
  });

  test('it accepts prexisting list items', function() {
    source.items = [];

    var list = document.createElement('ul');
    container.appendChild(list);

    while (source.items.length < 22) {
      var item = source.createItem(1);
      item.className = 'prexisting';
      item.style.position = 'absolute';
      item.style.left = '0px';
      item.style.top = '0px';
      item.style.overflow = 'hidden';
      item.style.willChange = 'transform';
      list.appendChild(item);
      source.items.push(item);
    }

    var createItem = sinon.spy(source, 'createItem');
    var fastList = new FastList(source);
    scheduler.mutation.yield();

    sinon.assert.notCalled(createItem);
    fastList; //jshint
  });

  test('it supports plugins', function(done) {
    var fastList = new FastList(source).plugin(function(list) {
      list.pluggedIn = function(cb) {
        cb && cb();
      };
    });

    fastList.pluggedIn(done);
  });

  test('.rendered Promise resolves when rendering complete', function() {
    scheduler.mutation.restore();
    var fastList = new FastList(source);
    var firstPromise = fastList.rendered;
    return firstPromise.then(() => {
      var items = container.querySelectorAll('li');
      assert.ok(items.length);
      fastList.reloadData();
      assert.notEqual(firstPromise, fastList.rendered);
      return fastList.rendered;
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
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: 15,
        to: 34,
        expectsDetail: true
      });
    });

    suite('scrolling a bit faster >', function() {
      setup(function() {
        container.scrollTop += 256; // 4 items
        scheduler.attachDirect.yield();
      });

      test('it updates the rendering but stops populating item details',
      function() {
        assertCurrentlyRenderedWindow({
          container: container,
          source: source,
          from: 19,
          to: 38
        });

        [35, 36, 37, 38].forEach(function(index) {
          var selector = 'ul li[data-index="' + index + '"]';
          var item = container.querySelector(selector);
          assert.ok(item);

          var img = item.querySelector('img');
          assert.notOk(img.src);
        });
      });
    });

    suite('scrolling really fast >', function() {
      setup(function() {
        container.scrollTop += 1200; // 2.5 viewports
        scheduler.attachDirect.yield();
      });

      test('it does not render anything new', function() {
        assertCurrentlyRenderedWindow({
          container: container,
          source: source,
          from: 15,
          to: 34
        });
      });

      suite('multiple times >', function() {
        setup(function() {
          container.scrollTop += 480; // 1 viewport
          scheduler.attachDirect.yield();
        });

        test('it still skips rendering', function() {
          assertCurrentlyRenderedWindow({
            container: container,
            source: source,
            from: 15,
            to: 34
          });
        });

        suite('then slowing down >', function() {
          setup(function() {
            container.scrollTop += 239; // 1/2 viewport
            scheduler.attachDirect.yield();
          });

          test('it catches up but is still skipping details', function() {
            assertCurrentlyRenderedWindow({
              container: container,
              source: source,
              from: 45,
              to: 64,
              expectsNoDetail: true
            });
          });

          suite('then slowing down a lot >', function() {
            setup(function() {
              container.scrollTop += 29; // 1/16 viewport
              scheduler.attachDirect.yield();
            });

            test('it catches up completely with details', function() {
              assertCurrentlyRenderedWindow({
                container: container,
                source: source,
                from: 46,
                to: 65,
                expectsDetail: true
              });
            });
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
        assertCurrentlyRenderedWindow({
          container: container,
          source: source,
          from: 7,
          to: 26
        });
      });
    });
  });

  suite('Scroll to bottom >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      scheduler.mutation.yield();
      container.scrollTop = container.scrollHeight - (480 * 2);
      scheduler.attachDirect.yield();
    });

    test('it does not throw', function() {
      container.scrollTop += 480;
      scheduler.attachDirect.yield();

      var options = {
        source: source,
        container: container,
        from: 993,
        to: 999
      };

      assertRenderedViewport(options);
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

    test('it does any pending detail population', function() {
      container.scrollTop = 0;
      scheduler.attachDirect.yield();

      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: 0,
        to: 19,
        expectsDetail: true
      });
    });
  });

  suite('FastList#scrollInstantly(by) >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      scheduler.mutation.yield();
    });

    test('it updates the rendering directly', function() {
      fastList.scrollInstantly(1200);
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: 15,
        to: 34
      });
    });

    test('it supports absolute values', function() {
      fastList.scrollInstantly(0);
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: 0,
        to: 19
      });

      fastList.scrollInstantly(480);
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: 4,
        to: 23
      });

      fastList.scrollInstantly(960);
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: 12,
        to: 31
      });
    });
  });

  suite('FastList#reloadData() >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      scheduler.mutation.yield();

      container.scrollTop = 1200;
      scheduler.attachDirect.yield();

      source.data[16].title = 'Totally new title';
      source.data.push({
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
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: 15,
        to: 34
      });
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

  suite('When content is late', function() {
    var fastList, populatePromise;

    setup(function() {
      populatePromise = new MockPromise();
      sinon.stub(source, 'populateItem').returns(populatePromise.promise);
      sinon.stub(source, 'populateItemDetail').returns(false);
      fastList = new FastList(source);
      scheduler.mutation.yield();
    });

    test('it should populate fully once the promise resolves', function() {
      var items = container.querySelectorAll('ul li');
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        assert.equal(item.dataset.populated, 'false');
      }

      source.populateItem.restore();
      source.populateItemDetail.restore();
      populatePromise.resolve();

      return Promise.resolve().then(function() {
        assertCurrentlyRenderedWindow({
          container: container,
          source: source,
          from: 0,
          to: 19,
          expectsDetail: true
        });
      });
    });

    test('it should reveal the item with a transition', function() {
      var trPromise = new MockPromise();
      var items = container.querySelectorAll('ul li');
      sinon.stub(scheduler, 'transition').returns(trPromise.promise);

      source.populateItem.restore();
      source.populateItemDetail.restore();
      populatePromise.resolve();

      return Promise.resolve().then(function() {
        scheduler.transition.yield();

        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          assert.equal(item.dataset.populated, 'true');
        }

        trPromise.resolve();
        return Promise.resolve().then(function() {
          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            assert.equal(item.style.transition, '');
          }
        });
      });
    });
  });

  suite('FastList#destroy()', function() {
    test('it unbinds the \'scroll\' handler', function() {
      var fastList = new FastList(source);

      scheduler.mutation.yield();
      sinon.assert.calledOnce(scheduler.attachDirect);
      var handler = scheduler.attachDirect.lastCall.args[2];

      fastList.destroy();

      sinon.assert.calledWith(
        scheduler.detachDirect,
        fastList.els.container,
        'scroll',
        handler
      );
    });
  });
});
