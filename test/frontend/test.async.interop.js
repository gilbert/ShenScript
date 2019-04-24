const { equal, ok, rejects } = require('assert');
const forEach                = require('mocha-each');
const backend                = require('../../src/backend');
const kernel                 = require('../../dist/kernel.async');
const frontend               = require('../../src/frontend');

(async () => {
  const { consFromArray, equal: eq, evalKl, exec, f, isArray, s, settle } = frontend(await kernel(backend({ async: true })));

  describe('async', () => {
    describe('interop', () => {
      describe('js.new', () => {
        it('should be able to construct globally referrable constructors', async () => {
          ok(isArray(await exec('(js.new Array [5])')));
        });
      });
      describe('js.obj', () => {
        it('should construct js object from series of key-value pairs', async () => {
          ok(eq({ a: 1, b: 2 }, await exec('(js.obj [["a" 1] ["b" 2]])')));
        });
      });
      describe('exec', () => {
        it('should work', async () => {
          equal(5, await exec('(+ 3 2)'));
          ok(eq(consFromArray([1, 2, 3]), await exec('[1 2 3]')));
        });
      });
    });
  });
})();
