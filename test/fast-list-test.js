/* global suite, sinon, setup, teardown, test, assert,
   DataSource, FastList, assertRenderedViewport,
   createDummyData, assertCurrentlyRenderedWindow, MockPromise */

suite('FastList >', function() {
  'use strict';

  var scheduler = FastList.scheduler;
  var expectedTotalItems;
  var itemsPerScreen;
  var container;
  var fakeDoc;
  var source;

  setup(function() {
    this.sinon = sinon.sandbox.create();
    this.sinon.stub(scheduler, 'attachDirect');
    this.sinon.stub(scheduler, 'detachDirect');

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

    itemsPerScreen = parseInt(container.style.height) / source.getItemHeight();
    var multiplier = FastList.prototype.PRERENDER_MULTIPLIER;
    expectedTotalItems = Math.floor(itemsPerScreen * multiplier);
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

    suite('> after render', function() {
      setup(function() {
        this.sinon.spy(DocumentFragment.prototype, 'appendChild');
        this.sinon.spy(fastList.els.itemContainer, 'appendChild');
        this.sinon.spy(source, 'unpopulateItemDetail');
        return fastList.complete;
      });

      test('it sets the required styles on the container', function() {
        assert.equal(container.style.overflowX, 'hidden');
        assert.equal(container.style.overflowY, 'scroll');
      });

      test('it attaches a direct block to the scroll event', function() {
        sinon.assert.calledOnce(scheduler.attachDirect);
        sinon.assert.calledWith(scheduler.attachDirect, container, 'scroll');
      });

      test('it calls source.getViewportHeight() if provided', function() {
        source.getViewportHeight = sinon.stub();
        source.getViewportHeight.returns(400);
        fastList = new FastList(source);
        return fastList.rendered.then(function() {
          sinon.assert.called(source.getViewportHeight);
        });
      });

      test('it sets the required styles on the list items', function() {
        var items = container.querySelectorAll('ul li');
        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          assert.equal(item.style.position, 'absolute');
          assert.equal(item.style.left, '0px');
          assert.equal(item.style.top, '0px');
          assert.equal(item.style.overflow, 'hidden');
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
        var itemCount = container.querySelectorAll('ul li').length;
        assert.equal(itemCount, expectedTotalItems);
      });

      test('it renders the correct content', function() {
        assertCurrentlyRenderedWindow({
          container: container,
          source: source,
          from: 0,
          to: expectedTotalItems - 1
        });
      });

      test('it renders into a fragment', function() {
        var appendChild = DocumentFragment.prototype.appendChild;
        var sections = container.querySelectorAll('ul section');
        var items = container.querySelectorAll('ul li');
        var callCount = sections.length + items.length;

        assert.equal(appendChild.callCount, callCount);

        // Once for phase1 and onces for phase2
        sinon.assert.calledTwice(fastList.els.itemContainer.appendChild);
      });

      test('unpopulateItemDetail() is not called on setup', function() {
        sinon.assert.notCalled(source.unpopulateItemDetail);
      });

      suite('when the model becomes tiny >', function() {
        setup(function() {
          var tinyData = createDummyData(3);
          source.data = tinyData;
          return fastList.reloadData();
        });

        test('the list is resized', function() {
          assert.equal(container.querySelector('ul').offsetHeight, 192);
        });

        test('unused items are hidden', function() {
          var selector = 'ul li[data-populated="false"]';
          var nodes = container.querySelectorAll(selector);
          assert.equal(nodes.length, expectedTotalItems - 3);
          [].forEach.call(nodes, function(node) {
            assert.equal(node.style.display, 'none');
          });
        });

        test('it renders the correct content', function() {
          assertCurrentlyRenderedWindow({
            container: container,
            source: source,
            from: 0,
            to: 2
          });
        });

        suite('then grows back', function() {
          setup(function() {
            var bigData = createDummyData(1000);
            source.data = bigData;
            return fastList.reloadData();
          });

          test('it renders the correct content', function() {
            assertCurrentlyRenderedWindow({
              container: container,
              source: source,
              from: 0,
              to: expectedTotalItems - 1
            });
          });
        });
      });
    });
  });

  test('it supports plugins', function(done) {
    var fastList = new FastList(source).plugin(function(list) {
      list.pluggedIn = function(cb) {
        cb && cb();
      };
    });

    fastList.pluggedIn(done);
  });

  suite('Scrolling >', function() {
    var fastList;
    var start;

    setup(function() {
      fastList = new FastList(source);
      return fastList.rendered.then(function() {
        this.sinon.useFakeTimers();
        start = 15;
        fastList.scrollInstantly(1000);
        container.scrollTop += 100;
        scheduler.attachDirect.yield();
        container.scrollTop += 100;
        scheduler.attachDirect.yield();
      }.bind(this));
    });

    test('it updates the full rendering', function() {
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: start,
        to: start + expectedTotalItems - 1,
        expectsDetail: true
      });
    });

    suite('then coming to a hard stop', function() {
      setup(function() {
        // no scroll events for 200ms
        this.sinon.spy(fastList, 'render');
        this.sinon.clock.tick(200);
      });

      test('it doesnt trigger an extra re-render', function() {
        sinon.assert.notCalled(fastList.render);
      });
    });

    suite('scrolling a bit faster >', function() {
      setup(function() {
        container.scrollTop += 256; // 4 items
        start += 4;
        scheduler.attachDirect.yield();
      });

      test('it updates the rendering but stops populating item details',
      function() {
        var end = start + expectedTotalItems - 1;

        assertCurrentlyRenderedWindow({
          container: container,
          source: source,
          from: start,
          to: end
        });

        // Check the last four items
        [end--, end--, end--, end].forEach(function(index) {
          var selector = 'ul li[data-index="' + index + '"]';
          var item = container.querySelector(selector);
          assert.ok(item);

          var img = item.querySelector('img');
          assert.notOk(img.src);
        });
      });

      suite('then coming to a hard stop', function() {
        setup(function() {
          // no scroll events for 200ms
          this.sinon.clock.tick(200);
        });

        test('it does a full rendering', function() {
          assertCurrentlyRenderedWindow({
            container: container,
            source: source,
            from: start,
            to: start + expectedTotalItems - 1,
            expectsDetail: true
          });
        });
      });
    });

    suite('scrolling really fast >', function() {
      setup(function() {
        container.scrollTop += 1200; // 2.5 viewports
        start = 15;
        scheduler.attachDirect.yield();
      });

      test('it does not render anything new', function() {
        assertCurrentlyRenderedWindow({
          container: container,
          source: source,
          from: start,
          to: start + expectedTotalItems - 1
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
            from: start,
            to: start + expectedTotalItems - 1
          });
        });

        suite('then slowing down >', function() {
          setup(function() {
            container.scrollTop += 239; // 1/2 viewport
            start = 45;
            scheduler.attachDirect.yield();
          });

          test('it catches up but is still skipping details', function() {
            assertCurrentlyRenderedWindow({
              container: container,
              source: source,
              from: start,
              to: start + expectedTotalItems - 1,
              expectsNoDetail: true
            });
          });

          suite('then slowing down a lot >', function() {
            setup(function() {
              container.scrollTop += 29; // 1/16 viewport
              start = 46;
              scheduler.attachDirect.yield();
            });

            test('it catches up completely with details', function() {
              assertCurrentlyRenderedWindow({
                container: container,
                source: source,
                from: start,
                to: start + expectedTotalItems - 1,
                expectsDetail: true
              });
            });

            suite('then coming to a hard stop', function() {
              setup(function() {
                // no scroll events for 200ms
                this.sinon.spy(fastList, 'render');
                this.sinon.clock.tick(200);
              });

              test('it doesnt trigger an extra re-render', function() {
                sinon.assert.notCalled(fastList.render);
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
        var itemHeight = source.getItemHeight();
        var start = Math.floor(container.scrollTop / itemHeight);
        var end = start + Math.floor((start + 480) / itemHeight);

        assertRenderedViewport({
          container: container,
          source: source,
          from: start,
          to: end
        });
      });
    });
  });

  suite('Scroll to bottom >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      return fastList.rendered.then(function() {
        container.scrollTop = container.scrollHeight - (480 * 2);
        scheduler.attachDirect.yield();
      });
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
      return fastList.rendered.then(function() {
        container.scrollTop = 1200;
        scheduler.attachDirect.yield();
      });
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
        to: expectedTotalItems - 1,
        expectsDetail: true
      });
    });
  });

  suite('FastList#scrollInstantly(by) >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      return fastList.rendered.then(function() {

        // We want the geometry to have been updated at least once for the
        // test to be reallistic
        container.scrollTop = 1;
        scheduler.attachDirect.yield();
      });
    });

    test('it updates the rendering directly, with details', function() {
      var start = 15;
      var end = start + expectedTotalItems - 1;

      fastList.scrollInstantly(1200);
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: start,
        to: end,
        expectsDetail: true
      });
    });

    test('it supports absolute values', function() {
      var start = 0;

      fastList.scrollInstantly(0);
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: start,
        to: start + expectedTotalItems - 1
      });

      start = 4;
      fastList.scrollInstantly(480);
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: start,
        to: start + expectedTotalItems - 1
      });

      start = 12;
      fastList.scrollInstantly(960);
      assertCurrentlyRenderedWindow({
        container: container,
        source: source,
        from: start,
        to: start + expectedTotalItems - 1
      });
    });
  });

  suite('FastList#reloadData() >', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);

      this.sinon.stub(source, 'unpopulateItemDetail');
      this.sinon.stub(source, 'populateItemDetail');

      return fastList.rendered.then(function() {
        container.scrollTop = 1200;
        scheduler.attachDirect.yield();

        source.data[16].title = 'Totally new title';
        source.data.push({
          title: 'Totally new title',
          body: 'Totally new body'
        });

        return fastList.reloadData();
      }.bind(this));
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
        to: 15 + expectedTotalItems - 1
      });
    });

    test('it calls unpopulateItemDetail() for each item rendered', function() {
      source.unpopulateItemDetail.reset();
      source.data = createDummyData(100);

      return fastList.reloadData()
        .then(function() {
          sinon.assert.callCount(source.unpopulateItemDetail,
            expectedTotalItems);
        });
    });

    test('it calls populateItemDetail() for each item rendered', function() {
      source.populateItemDetail.reset();
      source.data = createDummyData(100);

      return fastList.reloadData()
        .then(function() {
          sinon.assert.callCount(source.populateItemDetail,
            expectedTotalItems);
        });
    });
  });

  suite('Clicking an item', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      return fastList.rendered;
    });

    test('it dispatches a CustomEvent', function(done) {
      var item = container.querySelector('ul li');
      var clickEvt = new CustomEvent('click', {
        bubbles: true
      });

      container.addEventListener('item-selected', function wait(evt) {
        container.removeEventListener('item-selected', wait);

        assert.equal(evt.detail.index, '0');
        assert.equal(evt.detail.clickEvt, clickEvt);
        done();
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
      return fastList.complete;
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
          to: expectedTotalItems - 1,
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

  suite('promise hooks >>', function() {
    test('it resolves the `rendered` promise after phase1', function() {
      var fastList = new FastList(source);
      return fastList.rendered
        .then(function() {
          var items = container.querySelectorAll('li');
          assert.equal(items.length, 8, 'critical items only');
        });
    });

    test('it reolves the `complete` promise after phase2', function() {
      var fastList = new FastList(source);
      return fastList.complete
        .then(function() {
          var items = container.querySelectorAll('li');
          assert.isTrue(items.length > 8, 'includes prerendered items');
        });
    });
  });

  suite('FastList#destroy()', function() {
    var fastList;

    setup(function() {
      fastList = new FastList(source);
      return fastList.rendered;
    });

    test('it unbinds the \'scroll\' handler', function() {
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

  suite('initialScrollTop', function() {
    var setScrollTop;
    var scrollTopDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'scrollTop'
    );

    setup(function() {
      this.sinon.spy(FastList.prototype, 'render');
      setScrollTop = this.sinon.spy(scrollTopDescriptor, 'set');
      Object.defineProperty(Element.prototype, 'scrollTop', {
        set: setScrollTop,
        get: scrollTopDescriptor.get
      });
    });

    teardown(function() {
      Object.defineProperty(
        Element.prototype,
        'scrollTop',
        scrollTopDescriptor
      );
    });

    test('it sets the scrollTop of the container before render()', function() {
      source.initialScrollTop = 100;
      var fastList = new FastList(source);
      return fastList.rendered.then(function() {
        assert.isTrue(setScrollTop.calledBefore(fastList.render));
        sinon.assert.calledWith(setScrollTop, 100);
      });
    });

    test('list.scrollTop returns the validated scrollTop value', function() {
      source.initialScrollTop = 100;
      var fastList = new FastList(source);
      return fastList.rendered.then(function() {
        assert.equal(fastList.scrollTop, 100);

        // invalid
        source.initialScrollTop = -50;

        fastList = new FastList(source);
        return fastList.rendered;
      }).then(function() {
        assert.equal(fastList.scrollTop, 0);
      });
    });
  });
});
