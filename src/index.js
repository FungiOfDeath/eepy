import fs from 'node:fs';

import { analyze_usages } from './compiler-passes/200-analyze-usage.js';
import { compile_letrec } from './compiler-passes/300-compile-letrec.js';
import { flatten } from './compiler-passes/200-flatten-forms.js';
import {
  Env,
  Globals,
  resolve_names,
} from './compiler-passes/100-name-resolution.js';

import { parse } from './text/parse.js';
import { pretty_print } from './text/pretty-print.js';

const sample = fs.readFileSync('samples/random-shit-1.sample.lisp', {
  encoding: 'utf-8',
  flag: 'r',
});

visualize_pipeline(sample);

function visualize_pipeline(code) {
  print_header('parsing', '');
  const ast = parse(code);
  console.log('Result:');
  console.log(pretty_print(ast));

  print_header('name resolution');
  const globals = new Globals();
  const start_env = new Env(null, globals);
  const resolved = resolve_names(ast, start_env);
  console.log('Result:');
  console.log(pretty_print(resolved));
  console.log(
    '\nUndefined variables',
    [...globals.undefined_vars].map(([_, v]) => v),
  );

  print_header('analyze usages');
  console.log('Analysis');
  console.log(analyze_usages(resolved));

  print_header('flatten extraneously-nested forms');
  const flattened = flatten(resolved);
  console.log('Flattened:');
  console.log(pretty_print(flattened));

  print_header("compile-out letrec*'s");
  const depanalysis = compile_letrec(flattened);
  console.log('Compiled-out:');
  console.log(pretty_print(depanalysis));
}

function print_header(header, spacer = '\n\n\n\n\n') {
  spacer && console.log(spacer);
  console.log('=========================================');
  console.log(header);
  console.log('=========================================');
}
