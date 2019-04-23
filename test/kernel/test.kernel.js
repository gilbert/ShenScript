const async = process.argv.includes('async');

const fs              = require('fs');
const backend         = require('../../src/backend');
const { parseKernel } = require('../../scripts/parser');
const config          = require('../../scripts/config.node');

const InStream = class {
  constructor(buf) {
    this.buf = buf;
    this.pos = 0;
  }
  read() { return this.pos >= this.buf.length ? -1 : this.buf[this.pos++]; }
  close() {}
};

const OutStream = class {
  constructor(stream) {
    this.stream = stream;
  }
  write(b) { return this.stream.write(String.fromCharCode(b)); }
};

const { evalKl, s } = backend({
  ...config,
  async,
  InStream,
  OutStream,
  openRead: path => new InStream(fs.readFileSync(path)),
  stoutput: new OutStream(process.stdout),
  sterror:  new OutStream(process.stderr)
});

const { defuns, statements } = parseKernel();

const loadGroup = (name, exprs) => {
  const start = Date.now();
  let i = 0;
  console.log(`${name}: loading...`);
  for (let expr of exprs) {
    try {
      evalKl(expr);
    } catch (e) {
      console.log(expr);
      console.log(e);
    }
  }
  console.log(`${name}: ${exprs.length} loaded in ${Date.now() - start}ms`);
};

const loadGroupAsync = async (name, exprs) => {
  const start = Date.now();
  let i = 0;
  console.log(`${name}: loading...`);
  for (let expr of exprs) {
    try {
      await evalKl(expr);
    } catch (e) {
      console.log(expr);
      console.log(e);
    }
  }
  console.log(`${name}: ${exprs.length} loaded in ${Date.now() - start}ms`);
};

const formatDuration = x =>
  [[x / 60000, 'm'], [x / 1000 % 60, 's'], [x % 1000, 'ms']]
    .filter(([n, _]) => n >= 1)
    .map(([n, l]) => `${Math.floor(n)}${l}`)
    .join(', ');

if (async) {
  (async () => {
    const start = Date.now();
    await loadGroupAsync('defuns', defuns);
    await loadGroupAsync('statements', statements);
    console.log(await evalKl([s`cd`, config.testsPath]));
    console.log(await evalKl([s`load`, 'README.shen']));
    console.log(await evalKl([s`load`, 'tests.shen']));
    console.log(`total time elapsed: ${formatDuration(Date.now() - start)}`);
  })();
} else {
  const start = Date.now();
  loadGroup('defuns', defuns);
  loadGroup('statements', statements);
  console.log(evalKl([s`cd`, config.testsPath]));
  console.log(evalKl([s`load`, 'README.shen']));
  console.log(evalKl([s`load`, 'tests.shen']));
  console.log(`total time elapsed: ${formatDuration(Date.now() - start)}`);
}