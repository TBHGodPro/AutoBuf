#! /usr/bin/env node

import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
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

const file = join(process.cwd(), options.file);
const output = join(process.cwd(), options.output);

if (!file.endsWith('.json') || !existsSync(file)) throw new Error('Protocol Spec must be a valid JSON Protocol Spec File');

let spec;

try {
  spec = JSON.parse(await readFile(file), 'utf-8');
} catch {
  throw new Error('Protocol Spec must be a valid JSON Protocol Spec File');
}

await autobufModule.default(spec, output);

console.log('Successfully Generated Protocol!');
