import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createModelModes} from '../src/rendering/modelModes.js';
test('room isolation and exterior transparency restore shared materials and visibility',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),material=new THREE.MeshStandardMaterial();scene.add(root);
 const make=(name,x,z)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(.2,2,.2),material);m.name=name;m.position.set(x,1,z);m.castShadow=true;root.add(m);return m;};
 const wall=make('Wall exterior',-40,0),rack=make('Rack',0,-5),support=make('Support',15,0);
 const modes=createModelModes(root,scene);
 modes.apply('rooms');assert.equal(wall.visible,false);assert.equal(support.visible,false);assert.equal(rack.visible,true);
 modes.apply('transparent');assert.equal(wall.visible,true);assert.equal(wall.material.opacity,.16);assert.equal(wall.castShadow,false);assert.equal(rack.material,material);assert.equal(material.opacity,1);
 modes.apply('full');assert.equal(wall.material,material);assert.equal(support.visible,true);assert.equal(wall.castShadow,true);
 modes.apply('transparent');modes.dispose();assert.equal(wall.material,material);assert.equal(scene.children.length,1);
});
