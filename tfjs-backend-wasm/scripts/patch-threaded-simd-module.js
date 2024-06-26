/**
 * @license
 * Copyright 2021 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

/**
 * This file patches the Emscripten-generated WASM JS script so that it can be
 * properly loaded in web worker.
 *
 * We need to pass the content of this script to WASM module's
 * mainScriptUrlOrBlob field so that the web worker can correctly load the
 * script "inline". The returned content of the script (after it self-executes)
 * is a anonymous function object in which we have the following if block:
 *
 * if (_scriptDir) {
 *   scriptDirectory = _scriptDir;
 * }
 *
 * It works great if the script runs in the main page, where _scriptDir is
 * initialized to the path of the tf-backend-wasm.js file, outside of the
 * function object. However, when the script runs in a web worker, the
 * code that initializes _scriptDir won't be present since it is outside
 * of the scope of the function object. As a result, a "Uncaught
 * ReferenceError: _scriptDir is not defined" error will be thrown fron
 * the web worker.
 *
 * To fix this, we will replace all the occurences of "if(_scriptDir)"
 * with a better version that first checks whether _scriptDir is defined
 * or not
 *
 * For more context, see:
 * https://github.com/emscripten-core/emscripten/pull/12832
 */
const fs = require('fs');
const { ArgumentParser } = require('argparse');
const parser = new ArgumentParser();

parser.addArgument('jsFile', {
  type: String,
  help: 'The input js file to transform.',
});

parser.addArgument('outFile', {
  type: String,
  help: 'The output file path.',
});

const args = parser.parseArgs();

let content = fs.readFileSync(args.jsFile, 'utf8');
content = content.replace(
  /if\s*\(\s*_scriptDir\s*\)/g,
  'if(typeof _scriptDir !== "undefined" && _scriptDir)');
content = content.replace(/new Worker\(pthreadMainJs\)/g, 'new Worker(pthreadMainJs, { eval: true })');
fs.writeFileSync(args.outFile, content);
