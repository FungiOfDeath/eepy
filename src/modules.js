/// <reference path="types/parse-tree.d.ts" />
/// <reference path="types/modules.d.ts" />

import fs from 'node:fs';
import { gensym } from './utils/symbols';
import { Result } from './utils/result';

export const EEPY_SYSTEM_PATH = 'src/module-interfaces';
export const EEPY_LOCAL_PATH = 'samples';
export const EEPY_LIB_PATH = 'samples';

const system_import = /^sys:(?<mod>[a-z]+(?:\.[a-z]+)*)$/i;
const library_import = /^lib:(?<library>[a-z]+):(?<mod>[a-z]+(?:\.[a-z]+)*)$/i;
const local_import = /^(?:local\:)?(?<mod>[a-z]+(?:\.[a-z]+)*)$/i;

/** @type {Map<string, Module>} */
export const loaded_modules = new Map();

/**
 * @param {string} path
 * @returns {Result<Module, string>}
 */
export function ensure_loaded(path) {
  const parsed_result = parse_import(path);
  if (!parsed_result.ok) return parsed_result;
  const parsed = parsed_result.assert_ok();

  const found = loaded_modules.get(parsed.normalized);
  if (found) {
    return Result.Ok(found);
  }

  const json_result = read_import(parsed);
  if (!json_result.ok) return json_result;
  const json = json_result.assert_ok();

  const items = parse_json_interface(json);
  const mod = {
    normalized_path: parsed.normalized,
    qualified_name: parsed.path,
    items,
  };

  loaded_modules.set(parsed.normalized, mod);

  return Result.Ok(mod);
}

/**
 * @param {string} path
 * @returns {Result<{
 *  dir: string,
 *  mod: string,
 *  normalized: string,
 *  parts: string[],
 * }, string>}
 */
function parse_import(path) {
  const sys = path.match(system_import)?.groups;
  const lib = path.match(library_import)?.groups;
  const loc = path.match(local_import)?.groups;

  if (sys) {
    return Result.Ok({
      dir: EEPY_SYSTEM_PATH,
      mod: sys.mod,
      normalized: path,
      parts: ['sys', ...sys.mod.split(/\./g)],
    });
  } else if (lib) {
    const dir = `${EEPY_LIB_PATH}/${lib.library}`;
    return Result.Ok({
      dir,
      mod: lib.mod,
      normalized: path,
      parts: ['lib', lib.library, ...lib.mod.split(/\./g)],
    });
  } else if (loc) {
    return Result.Ok({
      dir: EEPY_LOCAL_PATH,
      mod: loc.mod,
      normalized: `local:${loc.mod}`,
      parts: ['local', ...loc.mod.split(/\./g)],
    });
  } else {
    return Result.Err(`invalid format for import path: '${path}'`);
  }
}

/**
 * @param {{ dir: string, mod: string }} parsed
 * @returns {Result<string, string>}
 */
function read_import(parsed) {
  const { dir, mod } = parsed;

  const dirstats = fs.lstatSync(dir);
  if (!dirstats) {
    return Result.Err(`Load path not found: ${dir}`);
  } else if (!dirstats.isDirectory) {
    return Result.Err(`Invalid load path, expected a directory: ${dir}`);
  }

  const files = fs.readdirSync(dir, {
    withFileTypes: true,
  });
  const found = files.find(file => {
    if (!file.isFile || !file.name.startsWith(mod)) {
      return false;
    }
    const rest = file.name.slice(mod.length);
    return rest.match(/^(?:\.json)$/);
  });

  if (!found) {
    return Result.Err(`Module not found: ${mod}\nLoad path: ${dir}`);
  }

  return Result.Ok(
    fs
      .readFileSync(`${found.parentPath}/${found.name}`, {
        encoding: 'utf8',
        flag: fs.constants.O_RDONLY,
      })
      .toString(),
  );
}

/**
 * @param {string} json
 * @returns {Map<string, ModuleItem>}
 */
function parse_json_interface(json) {
  const object = JSON.parse(json);
  const result = new Map();
  Object.getOwnPropertyNames(object).forEach(prop => {
    const name = gensym(prop);
    result.set(prop, { name, meta: object[prop] });
  });
  return result;
}
