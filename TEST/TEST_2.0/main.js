import { Mondo } from './class/modo.js';

const container = document.querySelector('#scene-container');
const SchermataCaricamento = document.querySelector('#cover');
const LoadingBar = document.querySelector("#progress-bar");
var FileLogo = document.querySelector("#file");

//const response = await fetch('./scene/Parco.json');
var response = await fetch('./scene/Industriale.json');
var json = await response.json();

const world = new Mondo(container, json["cameraPos"], json["scenecolor"]);
world.SetLoadingScreen(SchermataCaricamento, LoadingBar);


world.SetCameraControl(json["zoom"]["min"], json["zoom"]["max"]);
await world.initScene(json["scena"]);
world.changeMaterialOpacity(json["materialOpacity"]);

world.ColorChanger('#color-picker');
FileLogo=await world.LogoChanger(FileLogo)
world.SetResizeFunction();

world.start();


console.log('Le funzioni disponibili per il debug sono:\n1) postprocess();\n2) cameracollision();\n3) cameramovement();\n');

window.changescene = async function (fileJson) {
    var response = await fetch('./scene/'+fileJson);
    var json = await response.json();
    world.clear()
    world.SetNewScene(json["cameraPos"], json["scenecolor"])
    world.SetCameraControl(json["zoom"]["min"], json["zoom"]["max"]);
    await world.initScene(json["scena"]);
    world.changeMaterialOpacity(json["materialOpacity"]);
    
    world.ColorChanger('#color-picker');
    FileLogo=await world.LogoChanger(FileLogo)
    
    world.start();
    return "Scene changed"
}

window.postprocess = function () {
    world.addPostprocessing();
    return "Postprocessing added"
}

window.cameracollision = function () {
    world.CameraCollision();
    return "Now Camera will collide with scene's objects"
}

window.cameramovement = function () {
    world.CameraMovement({ "x": 0, "y": -0.5, "z": 0 }, { "x": 0, "y": 0.7, "z": 0 });
    return "Now Camera will move between the values"
}


var DivAmbienti = document.querySelector("#ambienti");
var ambienti=["Cittadina.json","Parco.json","Industriale.json"]
for(var i=0;i<ambienti.length;i++)
    DivAmbienti.innerHTML+='<a class="dropdown-item" href="#" onclick="changescene('+"'"+ambienti[i]+"'"+');">'+ambienti[i].split('.')[0]+'</a>'