#! /usr/bin/env node

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { isAbsolute, join } from 'path';
import yargs from 'yargs';
import autobufModule from '../dist/index.js';

const usage = `
Usage: autobuf`;

const options = yargs(process.argv)
  .usage(usage)
  .option('file', {
    alias: 'f',
    describe: 'The Protocol Spec File Path',
    type: 'string',
    demandOption: true,
    requiresArg: true,
  })
  .option('output', {
    alias: 'o',
    describe: 'The Output Protocol Directory Path',
    type: 'string',
    demandOption: true,
    requiresArg: true,
  })
  .help(true)
  .version().argv;

const file = isAbsolute(options.file) ? options.file : join(process.cwd(), options.file);
const output = isAbsolute(options.output) ? options.output : join(process.cwd(), options.output);

if ((!file.endsWith('.json') && !file.endsWith('.jsonc')) || !existsSync(file)) throw new Error('Protocol Spec must be a valid JSON Protocol Spec File');

let spec;

try {
  spec = await readFile(file, 'utf-8');

  if (file.endsWith('.jsonc')) spec = spec.replace(/\/\/.*|\/\*\*(.|\n|\r|\r\n|\n\r)*\*\//g, '');

  spec = JSON.parse(spec);
} catch {
  throw new Error('Protocol Spec must be a valid JSON Protocol Spec File');
}

await autobufModule.default(spec, output);

console.log('Successfully Generated Protocol!');
