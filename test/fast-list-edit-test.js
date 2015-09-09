/* global suite, sinon, setup, teardown, test, assert,
   DataSource, FastList, fastListEdit,
   createDummyData, assertCurrentlyRenderedWindow */

suite('FastList > Edit >', function() {
  'use strict';

  var fakeDoc, container, source, fastList;

  var scheduler = FastList.scheduler;

  var MockPromise = function() {
    this.promise = new Promise(function(resolve, reject) {
      this.resolve = resolve;
      this.reject = reject;
    }.bind(this));
  };

  function assertClassOnItems(css, on) {
    var items = container.querySelectorAll('ul li');

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      assert.equal(item.classList.contains(css), on);
    }
  }

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

    fastList = new FastList(source).plugin(fastListEdit);
    scheduler.mutation.yield();
  });

  teardown(function() {
    scheduler.attachDirect.restore();
    scheduler.mutation.restore();
    fakeDoc.remove();
  });

  suite('Toggling edit mode >', function() {
    var schedulerPromise;

    setup(function() {
      schedulerPromise = new MockPromise();
      sinon.stub(scheduler, 'feedback').returns(schedulerPromise.promise);
    });

    teardown(function() {
      scheduler.feedback.restore();
    });

    test('it exposes an |editing| property', function() {
      assert.isFalse(fastList.editing);
      fastList.toggleEditMode();
      assert.isTrue(fastList.editing);
      fastList.toggleEditMode();
      assert.isFalse(fastList.editing);
    });

    test('it returns a scheduler promise', function(done) {
      fastList.toggleEditMode().then(done);
      schedulerPromise.resolve();
    });

    test('it toggles the edit class on all dom items', function() {
      assertClassOnItems('edit', false);

      fastList.toggleEditMode();
      scheduler.feedback.yield();
      assertClassOnItems('edit', true);

      fastList.toggleEditMode();
      scheduler.feedback.yield();
      assertClassOnItems('edit', false);
    });
  });

  suite('Reordering >', function() {
    var schedulerPromise;

    var list;
    var draggedItem;
    var cursor;
    var draggedCenter;

    function itemCenter(item) {
      var rect = draggedItem.getBoundingClientRect();
      return [rect.left + 160, rect.top + 32];
    }

    function makeEvent(type, x, y) {
      var evt = document.createEvent('MouseEvents');
      evt.initMouseEvent(
        type, true, true, window, 0,
        x, y,
        x, y,
        false, false, false, false, 0, null
      );
      return evt;
    }

    function slide(from, to) {
      var current = from;
      while (current !== to) {
        var evt = makeEvent('mousemove', draggedCenter[0], current);
        cursor.dispatchEvent(evt);
        scheduler.attachDirect.yield(evt);

        if (to > current) {
          current++;
        } else {
          current--;
        }
      }
    }

    setup(function() {
      fastList.toggleEditMode();

      list = container.querySelector('ul');
      draggedItem = fakeDoc.querySelector('ul li:nth-child(5)');
      draggedCenter = itemCenter(draggedItem);
      cursor = draggedItem.querySelector('.cursor');
    });

    suite('starting the dragging gesture', function() {
      var startEvt;

      setup(function() {
        sinon.stub(scheduler, 'feedback');

        startEvt = makeEvent('mousedown', draggedCenter[0], draggedCenter[1]);

        schedulerPromise = new MockPromise();
        scheduler.mutation.returns(schedulerPromise.promise);

        cursor.dispatchEvent(startEvt);
      });

      teardown(function() {
        scheduler.feedback.restore();
      });

      test('it prevents default', function() {
        assert.isTrue(startEvt.defaultPrevented);
      });

      test('it does nothing for outside of the cursor', function() {
        var outside = new MouseEvent('mousedown', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        draggedItem.dispatchEvent(outside);
        assert.isFalse(outside.defaultPrevented);
      });

      suite('> flushing the mutation', function() {
        setup(function() {
          scheduler.mutation.yield();
        });

        test('it toggles the reordering background', function() {
          assert.isTrue(list.classList.contains('reordering'));
        });

        test('it moves up the draggedItem on the z-axis', function() {
          assert.equal(draggedItem.style.zIndex, 1000);
          assert.ok(draggedItem.style.boxShadow);
        });

        suite('> then', function() {
          setup(function(done) {
            schedulerPromise.resolve();
            Promise.resolve().then(done);
          });

          test('it attaches a direct block to the move event', function() {
            sinon.assert.calledOnce(
              scheduler.attachDirect.withArgs(list, 'mousemove'));
          });

          suite('> then', function() {
            setup(function(done) {
              Promise.resolve().then(done);
            });

            test('it schedules a feedback to remove the overlay', function() {
              scheduler.feedback.yield();
              var overlay = draggedItem.querySelector('.overlay');
              assert.equal(overlay.dataset.anim, 'hide');
            });
          });
        });
      });
    });

    suite('dragging', function() {
      setup(function(done) {
        this.sinon = sinon.sandbox.create();
        this.sinon.useFakeTimers();

        var mutationPromise = new MockPromise();
        scheduler.mutation.returns(mutationPromise.promise);

        var startEvt = makeEvent(
          'mousedown',
          draggedCenter[0],
          draggedCenter[1]
        );
        cursor.dispatchEvent(startEvt);

        scheduler.mutation.yield();
        mutationPromise.resolve();

        Promise.resolve().then(function() {
          Promise.resolve().then(function() {
            this.sinon.stub(scheduler, 'feedback', function(cb) {
              cb && cb();
              this.sinon.clock.tick();
              return Promise.resolve();
            }.bind(this));
            done();
          }.bind(this));
        }.bind(this));
      });

      teardown(function() {
        this.sinon.clock.restore();
        this.sinon.restore();
      });

      suite('up', function() {
        setup(function() {
          slide(draggedCenter[1], draggedCenter[1] - 200);
        });

        test('it moves the dragged item directly', function() {
          var transform = 'translate3d(0px, -7px, 0px)';
          assert.equal(draggedItem.style.transform, transform);
          assert.equal(draggedItem.dataset.tweakDelta, -199);
        });

        test('it schedules a feedback to move 3 items down', function() {
          assert.equal(scheduler.feedback.callCount, 3);

          var tweaked = list.querySelectorAll('li:not([data-tweak-delta=""])');
          assert.equal(tweaked.length, 3 + 1);

          for (var i = 0; i < tweaked.length; i++) {
            var moved = tweaked[i];
            if (moved === draggedItem) {
              continue;
            }

            sinon.assert.calledWith(
              scheduler.feedback,
              sinon.match.any,
              moved,
              'transitionend'
            );

            assert.equal(moved.dataset.tweakDelta, 64);
          }
        });

        suite('> then back in place', function() {
          setup(function() {
            slide(draggedCenter[1] - 200, draggedCenter[1] + 2);
          });

          test('it moves the dragged item directly', function() {
            var transform = 'translate3d(0px, 193px, 0px)';
            assert.equal(draggedItem.style.transform, transform);
            assert.equal(draggedItem.dataset.tweakDelta, 1);
          });

          test('it schedules a feedback to move items back in place',
          function() {
            assert.equal(scheduler.feedback.callCount, 6);

            var reset = list.querySelectorAll('li:not([data-tweak-delta=""])');
            assert.equal(reset.length, 1);
          });
        });
      });

      suite('down', function() {
        setup(function() {
          slide(draggedCenter[1], draggedCenter[1] + 70);
        });

        test('it moves the dragged item directly', function() {
          var transform = 'translate3d(0px, 261px, 0px)';
          assert.equal(draggedItem.style.transform, transform);
          assert.equal(draggedItem.dataset.tweakDelta, 69);
        });

        test('it schedules a feedback to move 1 items up', function() {
          assert.equal(scheduler.feedback.callCount, 1);

          var tweaked = list.querySelectorAll('li:not([data-tweak-delta=""])');
          assert.equal(tweaked.length, 1 + 1);

          for (var i = 0; i < tweaked.length; i++) {
            var moved = tweaked[i];
            if (moved === draggedItem) {
              continue;
            }

            sinon.assert.calledWith(
              scheduler.feedback,
              sinon.match.any,
              moved,
              'transitionend'
            );

            assert.equal(moved.dataset.tweakDelta, -64);
          }
        });

        suite('> then back in place', function() {
          setup(function() {
            slide(draggedCenter[1] + 70, draggedCenter[1] - 2);
          });

          test('it moves the dragged item directly', function() {
            var transform = 'translate3d(0px, 191px, 0px)';
            assert.equal(draggedItem.style.transform, transform);
            assert.equal(draggedItem.dataset.tweakDelta, -1);
          });

          test('it schedules a feedback to move items back in place',
          function() {
            assert.equal(scheduler.feedback.callCount, 2);

            var reset = list.querySelectorAll('li:not([data-tweak-delta=""])');
            assert.equal(reset.length, 1);
          });
        });
      });
    });

    suite('ending the dragging gesture', function() {
      var endEvt;

      setup(function(done) {
        this.sinon = sinon.sandbox.create();
        this.sinon.useFakeTimers();

        var mutationPromise = new MockPromise();
        scheduler.mutation.returns(mutationPromise.promise);

        var startEvt = makeEvent(
          'mousedown',
          draggedCenter[0],
          draggedCenter[1]
        );
        cursor.dispatchEvent(startEvt);

        scheduler.mutation.yield();
        mutationPromise.resolve();

        this.sinon.stub(scheduler, 'detachDirect');

        Promise.resolve().then(function() {
          Promise.resolve().then(function() {
            this.sinon.stub(scheduler, 'feedback', function(cb) {
              cb && cb();
              this.sinon.clock.tick();
              return Promise.resolve();
            }.bind(this));

            slide(draggedCenter[1], draggedCenter[1] - 200);

            endEvt = makeEvent(
              'mouseup',
              draggedCenter[0],
              draggedCenter[1] - 200
            );
            cursor.dispatchEvent(endEvt);

            done();
          }.bind(this));
        }.bind(this));
      });

      teardown(function() {
        this.sinon.clock.restore();
        this.sinon.restore();
      });

      test('it prevents default', function() {
        assert.isTrue(endEvt.defaultPrevented);
      });

      test('it detaches the direct block from the move event', function() {
        sinon.assert.calledOnce(scheduler.detachDirect);
        sinon.assert.calledWith(scheduler.detachDirect, list, 'mousemove');
      });

      test('it schedules a feedback to move all items to their final position',
      function() {
        assert.equal(scheduler.feedback.callCount, 3 + 1);

        var tweaked = list.querySelectorAll('li:not([data-tweak-delta=""])');
        assert.equal(tweaked.length, 3 + 1);

        for (var i = 0; i < tweaked.length; i++) {
          var moved = tweaked[i];

          sinon.assert.calledWith(
            scheduler.feedback,
            sinon.match.any,
            moved,
            'transitionend'
          );

          if (moved === draggedItem) {
            assert.equal(moved.dataset.tweakDelta, -192);
          } else {
            assert.equal(moved.dataset.tweakDelta, 64);
          }
        }
      });

      suite('> after the transition', function() {
        setup(function(done) {
          Promise.resolve().then(done);
          this.sinon.spy(source, 'removeAtIndex');
          this.sinon.spy(source, 'insertAtIndex');
        });

        test('it commits the change in a mutation', function() {
          scheduler.mutation.yield();
          sinon.assert.calledWith(source.removeAtIndex, 3);
          sinon.assert.calledWith(source.insertAtIndex, 0);
          assertCurrentlyRenderedWindow({
            container: container,
            source: source,
            from: 0,
            to: 21
          });
        });

        test('it resets the draggedItem on the z-axis', function() {
          scheduler.mutation.yield();
          assert.equal(draggedItem.style.zIndex, '');
          assert.equal(draggedItem.style.boxShadow, '');
        });

        suite('> and after the mutation', function() {
          setup(function() {
            scheduler.mutation.yield();
          });

          test('it schedules a feedback to remove the overlay', function() {
            assert.equal(scheduler.feedback.callCount, 3 + 1 + 1);
            var overlay = draggedItem.querySelector('.overlay');
            assert.equal(overlay.dataset.anim, 'reveal');
          });
        });
      });
    });
  });
});
