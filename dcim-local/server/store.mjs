import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {createStoreFromDatabase} from './store-core.mjs';
export function createStore(path){
 mkdirSync(dirname(path),{recursive:true});
 return createStoreFromDatabase(new DatabaseSync(path));
}
