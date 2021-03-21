import { Mondo } from './class/modo.js';

const container = document.querySelector('#scene-container');
const SchermataCaricamento =document.querySelector('#cover');
const LoadingBar=document.querySelector("#progress-bar");
const FileLogo=document.querySelector("#file");

//const response = await fetch('./scene/Cittadina.json');
//const response = await fetch('./scene/Parco.json');
const response = await fetch('./scene/Industriale.json');
const json = await response.json();

const world = new Mondo(container,json["cameraPos"],json["scenecolor"]);
world.SetLoadingScreen(SchermataCaricamento,LoadingBar);


world.SetCameraControl(0.7,30);
await world.initScene(json["scena"]);
world.changeMaterialOpacity(json["materialOpacity"]);

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
