import { Mondo } from './class/modo.js';
const container = document.querySelector('#scene-container');

const world = new Mondo(container,{"x":-1,"y":0,"z":1},'lightblue');
//world.SetCameraControl(0.7,3);
world.SetCameraControl(0.7,30);
//world.CameraCollision();
//world.CameraMovement({"x":0,"y":-0.5,"z":0},{"x":0,"y": 0.7,"z":0});
//world.addPostprocessing();
await world.initScene({ "oggetti":[ { "path":"../gltf/Cittadino/Cittadina.gltf","position":{"x":0,"y":0,"z":0},"collide": true },{ "path":"../gltf/LowPolyTotem/Totem.gltf","position":{"x":0,"y":-0.13,"z":0} ,"collide": false} ], "environment": "../hdr/suburban_parking_area_2k.exr" })
world.changeMaterialOpacity(["Finestra","Glass"],[0.1 , 0.4]);
world.SetResizeFunction();
world.start();
