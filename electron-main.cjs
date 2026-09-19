'use strict';
const Module = require('module');
const _load = Module._load.bind(Module);
let patching = false;
Module._load = function (request, parent, isMain) {
  if (request === 'electron' && !patching) {
    patching = true;
    // Load with this module as parent (so node_modules/electron is found),
    // but the result from node_modules/electron/index.js will be the path string.
    // Instead, after node_modules/electron/index.js runs and sets up its exports,
    // we need to get the real API. Since Electron intercepts at _resolveFilename
    // level for the MAIN entry only, we need a different approach.
    //
    // Solution: temporarily rename node_modules/electron/index.js so it can't
    // be found, forcing Electron's built-in to be used.
    const fs = require('fs');
    const path = require('path');
    const indexPath = path.join(__dirname, 'node_modules', 'electron', 'index.js');
    const tempPath = indexPath + '.bak';
    fs.renameSync(indexPath, tempPath);
    let result;
    try {
      result = _load('electron', module, false);
    } finally {
      fs.renameSync(tempPath, indexPath);
      patching = false;
    }
    return result;
  }
  return _load(request, parent, isMain);
};
require('./dist/electron/main.cjs');
