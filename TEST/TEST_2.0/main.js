import { Mondo } from './class/modo.js';

const container = document.querySelector('#scene-container');
const SchermataCaricamento = document.querySelector('#cover');
const LoadingBar = document.querySelector("#progress-bar");
var FileLogo = document.querySelector("#file");

//const response = await fetch('./scene/Parco.json');
var response = await fetch('./scene/Cittadina.json');
var json = await response.json();

const world = new Mondo(container, json["camera"]["cameraPos"], json["scena"]["scenecolor"],json["postprocess"]);
world.SetLoadingScreen(SchermataCaricamento, LoadingBar);


world.SetCameraControl(json["camera"]["zoom"]);
await world.initScene(json["scena"]);
world.AllCastShadow()
world.SetCameraListeners(json["camera"]["CameraMovement"]);
world.changeMaterialOpacity(json["materialOpacity"]);

world.ColorChanger('#color-picker');
FileLogo = await world.LogoChanger(FileLogo)
world.SetResizeFunction();

world.start();


console.log("La funzione per liberare la telecamera e muoversi liberamente è 'debugMode();'");

window.changescene = async function (num, fileJson) {
    if(await world.togglePostProcessing(json["postprocess"]))
    {
        await world.togglePostProcessing(json["postprocess"]);
    }

    for (var i = 0; i < document.getElementsByName("ambiente").length; i++) {
        document.getElementsByName("ambiente")[i].style.fontWeight = "normal";
    }
    document.getElementsByName("ambiente")[num].style.fontWeight = "bold";

    response = await fetch('./scene/' + fileJson);
    json = await response.json();
    await world.togglePostProcessing(json["postprocess"]);
    world.clear()
    world.SetNewScene(json["camera"]["cameraPos"], json["scena"]["scenecolor"])
    world.SetCameraControl(json["camera"]["zoom"]);
    await world.initScene(json["scena"]);
    world.AllCastShadow()
    world.SetCameraListeners(json["camera"]["CameraMovement"]);
    world.changeMaterialOpacity(json["materialOpacity"]);

    world.ColorChanger('#color-picker');
    FileLogo = await world.LogoChanger(FileLogo)

    world.start();
    return "Scene changed"
}

window.togglePostProcessing = function () {
    world.togglePostProcessing(json["postprocess"]);
    return "Postprocessing toggle"
}

window.debugMode = function () {
    world.toggleDebugMode();
    return "Debug Mode toggle"
}


var DivAmbienti = document.querySelector("#ambienti");
var ambienti = ["Cittadina.json", "Parco.json", "Industriale.json"]
var line = ""
for (var i = 0; i < ambienti.length; i++) {
    line = '<a name="ambiente" class="dropdown-item" href="#" onclick="changescene(' + i + ",'" + ambienti[i] + "'" + ');"';
    if (i == 0) {
        line += 'style="font-weight: bold"';
    }
    line += '>' + ambienti[i].split('.')[0] + '</a>';
    DivAmbienti.innerHTML += line;
}

document.getElementById("postproc").addEventListener("click", function () {
    togglePostProcessing();
}
);
