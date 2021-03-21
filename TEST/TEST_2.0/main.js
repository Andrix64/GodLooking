import { Mondo } from './class/modo.js';

const container = document.querySelector('#scene-container');
const SchermataCaricamento =document.querySelector('#cover');
const LoadingBar=document.querySelector("#progress-bar");
const FileLogo=document.querySelector("#file");

const world = new Mondo(container,{"x":-1,"y":0,"z":1});
world.SetLoadingScreen(SchermataCaricamento,LoadingBar);


world.SetCameraControl(0.7,30);
await world.initScene({ "oggetti":[ { "path":"../gltf/Cittadino/Cittadina.gltf","position":{"x":0,"y":0,"z":0},"collide": true },{ "path":"../gltf/LowPolyTotem/Totem.gltf","position":{"x":0,"y":-0.13,"z":0} ,"collide": false} ], "environment": "../hdr/suburban_parking_area_2k.exr" });
world.changeMaterialOpacity(["Finestra","Glass"],[0.1 , 0.4]);

world.ColorChanger('#color-picker');
world.LogoChanger(FileLogo)
world.SetResizeFunction();

world.start();



console.log("Le funzioni disponibili per il debug sono:\n1) postprocess();\n2) cameracollision();\n3) cameramovement();")

window.postprocess = function() {
    world.addPostprocessing();
    return "Postprocessing added"
}

window.cameracollision=function() {
    world.CameraCollision();
    return "Now Camera will collide with scene's objects"
}

window.cameramovement=function() {
    world.CameraMovement({"x":0,"y":-0.5,"z":0},{"x":0,"y": 0.7,"z":0});
    return "Now Camera will move between the values"
}
