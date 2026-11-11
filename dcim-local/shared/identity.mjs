import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex} from '@noble/hashes/utils.js';
export const randomUUID=()=>globalThis.crypto.randomUUID();
export function createHash(algorithm){
 if(algorithm!=='sha256')throw Error('Unsupported hash');
 const hash=sha256.create();
 return {update(value){hash.update(new TextEncoder().encode(value));return this;},digest(format){if(format!=='hex')throw Error('Unsupported digest');return bytesToHex(hash.digest());}};
}
