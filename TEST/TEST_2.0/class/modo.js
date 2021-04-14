//importa three.js
import * as THREE from '../../../three.js/build/three.module.js';

//importa i controlli orbitali
import { OrbitControls } from '../../../three.js/examples/jsm/controls/OrbitControls.js';

//importa i loader di modelli,texture e decompressori
import { GLTFLoader } from '../../../three.js/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from '../../../three.js/examples/jsm/loaders/OBJLoader.js';
import { EXRLoader } from '../../../three.js/examples/jsm/loaders/EXRLoader.js';
import { RGBELoader } from '../../../three.js/examples/jsm/loaders/RGBELoader.js';
import { DRACOLoader } from '../../../three.js/examples/jsm/loaders/DRACOLoader.js';

//Importa necessario per post processing
import { EffectComposer } from '../../../three.js/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../../three.js/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from '../../../three.js/examples/jsm/postprocessing/BokehPass.js';
import { SAOPass } from '../../../three.js/examples/jsm/postprocessing/SAOPass.js';

//lensflare
import { Lensflare, LensflareElement } from '../../../three.js/examples/jsm/objects/Lensflare.js';


var debug = false;

class Mondo {
    constructor(container, camerapos, sceneColor, post) //Costruttore (setta le basi)
    {
        this.innerWidth=window.innerWidth
        this.innerHeight=window.innerHeight
        this.container = container;
        this.loadingscreen = undefined;
        this.loadingbar = undefined;
        this.postprocessing = {};
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 300);
        this.camera.position.set(camerapos.x, camerapos.y, camerapos.z);

        this.controls = null;
        this.sceneMeshes = new Array();

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('../../three.js/examples/js/libs/draco/');

        this.scene = new THREE.Scene();
        {
            if (sceneColor != undefined && sceneColor != null)
                this.scene.background = new THREE.Color(sceneColor);
        }
        this.exposeObj = new Array();
        this.mixers = [];

        this.clock = new THREE.Clock();

        let AA = true
        if (window.devicePixelRatio > 1) {
            AA = false
        }
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: AA,
            powerPreference: "high-performance"
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.renderer.shadowMap.enabled = true;//SHADOWMAP
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;//SHADOWMAP TYPE
        this.renderer.physicallyCorrectLights = true;
        this.container.appendChild(this.renderer.domElement);
        this.initPostprocessing()
        this.togglePostProcessing(post)
        this.onWindowResize(this.camera, this.renderer, this.postprocessing);
    }

    //pathsOBJ è un oggetto che contiene i link agli oggetti e all'environment da aggiungere nella scena e la posizione x,y,z in cui posizionarli. ESEMPIO { "oggetti":[ { "path":"./link/Oggetto.gltf","position":{"x":0,"y":0,"z":0},"collide": true },.... ], "environment": "./link/Environment.exr" }
    async initScene(paths) {
        if (this.loadingbar != undefined) {
            this.loadingbar.style.width = "5%";
        }

        const requests = paths.oggetti.map((link) => {
            return this.LoadObject(link.path);
        });

        var allReturn, posObj;

        if (this.loadingbar != undefined) {
            this.loadingbar.style.width = "25%";
        }

        if (paths.environment != undefined) {
            posObj = 1

            allReturn = await Promise.all([
                this.LoadEquirectangular(paths.environment),
                requests,
            ]);
            this.PrepareSceneEnviroment(allReturn[0]);

        } else {
            allReturn = await Promise.all([
                requests,
            ]);
            posObj = 0
        }
        if (this.loadingbar != undefined) {
            this.loadingbar.style.width = "50%";
        }

        await this.PrepareSceneObject(allReturn[posObj], paths);
        this.renderer.shadowMap.autoUpdate = paths.autoUpdate;
        if (paths.lights != undefined) {
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            await this.LoadLights(paths.lights);
        }

        if (this.loadingbar != undefined) {
            this.loadingbar.style.width = "100%";
        }
        if (this.loadingscreen != undefined) {
            async function fadeout(load, loadingbar) {
                load.style.opacity -= 0.05;
                if (load.style.opacity > 0) {
                    setTimeout(function () { fadeout(load, loadingbar) }, 50);
                } else {
                    load.style.width = "1px";
                    load.style.height = "1px";
                    loadingbar.style.width = "0%";
                }
            }

            fadeout(this.loadingscreen, this.loadingbar);
        }

    }

    //setta i filtri postprocessing
    initPostprocessing() {
        const renderPass = new RenderPass(this.scene, this.camera);
        const composer = new EffectComposer(this.renderer);

        composer.addPass(renderPass);


        this.postprocessing.composer = composer;

        const bokehPass = new BokehPass(this.scene, this.camera, {
            width: window.innerWidth,
            height: window.innerHeight
        });
        const saoPass = new SAOPass(this.scene, this.camera, false, true);

        this.postprocessing.bokeh = bokehPass;
        this.postprocessing.saoPass = saoPass;
    }

    //preparare l'environment
    PrepareSceneEnviroment(Return) {
        if (Return != 0) {
            const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
            const envMap = pmremGenerator.fromEquirectangular(Return).texture;
            const rt = new THREE.WebGLCubeRenderTarget(Return.image.height);
            rt.fromEquirectangularTexture(this.renderer, Return);
            if (this.scene.background == null) {
                this.scene.background = rt;
            }
            this.scene.environment = envMap;
            Return.dispose();
        }
    }

    //preparare gli oggetti della scena
    async PrepareSceneObject(Return, paths) {
        for (var i = 0; i < Return.length; i++) {
            await Return[i].then((result) => {
                if (result != 0) {
                    //ADD MIXER
                    this.mixers.push(new THREE.AnimationMixer(result.scene));
                    result.animations.forEach((clip) => {

                        this.mixers[this.mixers.length - 1].clipAction(clip).play();

                    });

                    //ADD SCENE
                    if (paths.oggetti[i].collide) {
                        result.scene.traverse((child) => {
                            if (child.isMesh) {
                                this.sceneMeshes.push(child);
                            }
                        });
                    }

                    //Oggetti che subiscono il raycast del depth of field
                    if (paths.oggetti[i].expose) {
                        result.scene.traverse((child) => {
                            if (child.isMesh) {
                                this.exposeObj.push(child);
                            }
                        });
                    }
                    result.scene.traverse((child) => {
                        if (child.isMesh) {
                            var customDepthMaterial = new THREE.MeshDepthMaterial({

                                depthPacking: THREE.RGBADepthPacking,

                                map: child.material.map, // or, alphaMap: myAlphaMap

                                alphaTest: 0.5

                            });
                            child.customDepthMaterial = customDepthMaterial;
                        }
                    });
                    result.scene.rotation.y = Math.PI / (180 / paths.oggetti[i].rotate);
                    result.scene.position.set(paths.oggetti[i].position.x, paths.oggetti[i].position.y, paths.oggetti[i].position.z);
                    this.scene.add(result.scene);
                } else {
                    alert("Elemento " + i + " : Formato non supportato");
                }

            });
        }
        if (paths.repeat != null) {
            for (var y = -paths.repeat.times; y <= paths.repeat.times; y++) {
                if (y != 0) {
                    let re = this.scene.clone();
                    re.position.set(y * paths.repeat.offset.x, y * paths.repeat.offset.y, y * paths.repeat.offset.z);
                    this.scene.add(re);
                }
            }
        }
    }

    //Setta tutti i listener per il movimento della telecamera
    SetCameraListeners(boundaries) {
        this.SetDepthOfField()
        this.CameraCollision();
        this.CameraMovement(boundaries["min"], boundaries["max"]);
    }

    //setta la posizione della camera e il colore della scena(inoltre setta la schermata di caricamento)
    SetNewScene(camerapos, sceneColor) {
        if (sceneColor != undefined && sceneColor != null) {
            this.scene.background = new THREE.Color(sceneColor);
        }
        this.camera.position.set(camerapos.x, camerapos.y, camerapos.z);
        this.SetLoadingScreen(this.loadingscreen, this.loadingbar)
    }

    //setta la schermata di caricamento
    SetLoadingScreen(loadscreen, loadbar) {
        this.loadingscreen = loadscreen;
        this.loadingbar = loadbar;
        this.loadingscreen.style.opacity = 1;
        this.loadingscreen.style.width = "100%";
        this.loadingscreen.style.height = "100%";
    }

    //Setta il controller della telecamera prendendo il massimo e il minimo che la telecamera può zoomare
    SetCameraControl(zoom, target) {
        if (this.controls != null) {
            this.controls.dispose();
        }

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = zoom["min"];
        this.controls.maxDistance = zoom["max"];
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.enablePan = true;
        if (target != undefined)
            this.controls.target.set(target.x, target.y, target.x);
        else
            this.controls.target.set(0, 0, 0);

        this.controls.update();
    }

    //Setta il  listener per modificare il DoF in base alla posizione della telecamera e dell'oggetto
    async SetDepthOfField() {
        //Variabili per collisione
        let intersectsOBJ = new Array();
        const raycasterBlur = new THREE.Raycaster();
        var Cpostprocessing = this.postprocessing, Ccamera = this.camera;
        var CexposeObj = this.exposeObj

        this.controls.addEventListener("change", DoFListen)
        DoFListen()
        //this.controls.dispatchEvent(new Event('change'));
        function DoFListen() {
            //depth of field
            raycasterBlur.setFromCamera(new THREE.Vector2(0, 0), Ccamera);
            if (CexposeObj.length != 0) {
                intersectsOBJ = raycasterBlur.intersectObjects(CexposeObj);
                if (intersectsOBJ[0] != undefined)
                    Cpostprocessing.bokeh.uniforms["focus"].value = intersectsOBJ[0].distance;
            }
        }
    }

    //setta come listener il resizer della finestra
    async SetResizeFunction() {
        window.addEventListener('resize', () => {
            this.innerWidth=window.innerWidth, this.innerHeight=window.innerHeight;
            this.onWindowResize(this.camera, this.renderer, this.postprocessing)
        });
    }

    //carica l'Equirectangular dal link
    async LoadEquirectangular(path) {
        var estensione = path.split("/").slice(-1)[0].split(".").slice(-1)[0].toLowerCase();
        var loader, errore = false;
        switch (estensione) {
            case "exr":
                loader = new EXRLoader();
                break;

            case "hdr":
                loader = new RGBELoader()
                break;
            default:
                errore = true;
        }
        if (errore) {
            return 0;
        }
        loader.setDataType(THREE.UnsignedByteType)

        const texture = await Promise.all([
            loader.loadAsync(path),
        ]);
        return texture[0];
    }

    //carica gli oggetti dal link
    async LoadObject(path) {
        var estensione = path.split("/").slice(-1)[0].split(".").slice(-1)[0].toLowerCase();

        var loader, errore = false;
        switch (estensione) {
            case "gltf":
            case "glb":
                loader = new GLTFLoader();
                loader.setDRACOLoader(this.dracoLoader);
                break;
            case "obj":
                loader = new OBJLoader();
            default:
                errore = true;
        }
        if (errore) {
            return 0;
        }

        const object = await Promise.all([
            loader.loadAsync(path),
        ]);
        return object[0];
    }

    //carica le luci
    async LoadLights(path) {
        const lightgroup = new THREE.Group();

        for (var i = 0; i < path.length; i++) {
            if (path[i].attiva) {
                var light;
                switch (path[i].type) {
                    case "spot":

                        light = new THREE.SpotLight(path[i].color, path[i].intensity, path[i].distance, path[i].angle, path[i].penumbra, path[i].decay);
                        var targetObject = new THREE.Object3D();
                        this.scene.add(targetObject);
                        targetObject.position.set(path[i].target.x, path[i].target.y, path[i].target.z)
                        light.target = targetObject;
                        break;
                    case "directional":

                        light = new THREE.DirectionalLight(path[i].color, path[i].intensity)
                        var targetObject = new THREE.Object3D();
                        this.scene.add(targetObject);
                        targetObject.position.set(path[i].target.x, path[i].target.y, path[i].target.z)
                        light.target = targetObject;
                        if (path[i].shadow !== undefined && path[i].shadow.castShadow) {
                            light.shadow.camera.left = -path[i].shadow.cameraSize;
                            light.shadow.camera.right = path[i].shadow.cameraSize;
                            light.shadow.camera.top = path[i].shadow.cameraSize;
                            light.shadow.camera.bottom = -path[i].shadow.cameraSize;
                        }
                        break;
                    case "point":

                        light = new THREE.PointLight(path[i].color, path[i].intensity, path[i].distance, path[i].decay)
                        if (path[i].shadow !== undefined && path[i].shadow.showCamera) {
                            var pointLightHelper = new THREE.PointLightHelper(light, 1);
                            this.scene.add(pointLightHelper);
                        }
                        break;
                    default:
                        break;
                }

                light.position.set(path[i].position.x, path[i].position.y, path[i].position.z);
                light.castShadow = path[i].shadow.castShadow; // default false

                if (path[i].Lensflare !== undefined && path[i].Lensflare.flare) {
                    var textureLoader = new THREE.TextureLoader();
                    for (var k = 0; k < path[i].Lensflare.list.length; k++) {
                        var textureFlare = textureLoader.load(path[i].Lensflare.list[k].texture);
                        var lensflare = new Lensflare();
                        for (var j = 0; j < path[i].Lensflare.list[k].pos.length; j++)
                            lensflare.addElement(new LensflareElement(textureFlare, path[i].Lensflare.list[k].pos[j].size, path[i].Lensflare.list[k].pos[j].distance, new THREE.Color(path[i].Lensflare.list[k].pos[j].color)));
                        light.add(lensflare);
                    }

                }

                if (path[i].shadow !== undefined && path[i].shadow.castShadow) {
                    light.shadow.mapSize.width = path[i].shadow.mapWidth; // default
                    light.shadow.mapSize.height = path[i].shadow.mapHeight; // default
                    light.shadow.camera.near = path[i].shadow.cameraNear; // default
                    light.shadow.camera.far = path[i].shadow.cameraFar; // default
                    light.shadow.focus = path[i].shadow.focus; // default
                    light.shadow.bias = path[i].shadow.bias;
                    if (path[i].shadow.showCamera && path[i].type != "point") {
                        var helper = new THREE.CameraHelper(light.shadow.camera);
                        this.scene.add(helper);
                    }

                }
                lightgroup.add( light );
                lightgroup.name="light";
                this.scene.add(lightgroup);
            }
        }

    }

    //Aggiunge il listener per la collisione con la scena
    async CameraCollision() {
        //Variabili per collisione
        const raycaster = new THREE.Raycaster();
        let dir = new THREE.Vector3();
        let intersects = new Array();

        //Quando la telecamera cambia posizione
        this.controls.addEventListener("change", () => {

            //collision detector
            if (!debug) {
                raycaster.set(this.controls.target, dir.subVectors(this.camera.position, this.controls.target).normalize())
                intersects = raycaster.intersectObjects(this.sceneMeshes, false);
                if (intersects.length > 0) {
                    if (intersects[0].distance < this.controls.target.distanceTo(this.camera.position)) {
                        this.camera.position.copy(intersects[0].point)
                    }
                }
            }

        })

        this.controls.update();
    }

    //Aggiunge il listener per il movimento consentito della telecamera prendendo il massimo e il minimo 
    async CameraMovement(MiPan, MaPan) {
        //variabili per spostamento
        var minPan = new THREE.Vector3(MiPan.x, MiPan.y, MiPan.z);
        var maxPan = new THREE.Vector3(MaPan.x, MaPan.y, MaPan.z);
        var _v = new THREE.Vector3();

        //Quando la telecamera cambia posizione
        this.controls.addEventListener("change", () => {
            //movimento camera
            if (!debug) {
                _v.copy(this.controls.target);
                this.controls.target.clamp(minPan, maxPan);
                _v.sub(this.controls.target);
                this.camera.position.sub(_v);
            }
        })

        this.controls.update();
    }

    BakeShadow() {
        this.renderer.shadowMap.needsUpdate=true
    }

    //Setta tutte le mesh in modo che possano dare e ricevere ombra
    async AllCastShadow() {
        this.scene.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }
    
    //Sistema i render in base alla grandezza e ratio della finestra
    async onWindowResize(Ccamera, Crenderer, Cpostprocessing) {
        Ccamera.aspect = this.innerWidth/this.innerHeight;
        Ccamera.updateProjectionMatrix();

        Crenderer.setSize(this.innerWidth,this.innerHeight);
        Cpostprocessing.composer.setSize(this.innerWidth,this.innerHeight);
    }

    //Configura il postprocessing
    async configPostProcessing(effect, conf) {
        for (var k = 0; k < conf.length; k++) {
            if (typeof effect.uniforms !== "undefined")
                effect.uniforms[conf[k]["name"]].value = conf[k]["value"]
            else
                effect.params[conf[k]["name"]] = conf[k]["value"]
        }
    }

    //attiva/disattiva il postprocessing
    async togglePostProcessing(postproc) {
        if (this.postprocessing.composer.passes.length > 1) {
            for (var i = 0; i < postproc.length; i++) {
                switch (postproc[i]["name"]) {
                    case "SAOPass":
                        this.postprocessing.composer.removePass(this.postprocessing.saoPass)
                        break;
                    case "BokehPass":
                        this.postprocessing.composer.removePass(this.postprocessing.bokeh)
                        break;

                    default:
                        break;
                }
            }
            return false;

        } else {
            for (var i = 0; i < postproc.length; i++) {
                switch (postproc[i]["name"]) {
                    case "SAOPass":
                        this.postprocessing.composer.addPass(this.postprocessing.saoPass)
                        this.configPostProcessing(this.postprocessing.saoPass, postproc[i]["config"])
                        break;
                    case "BokehPass":
                        this.postprocessing.composer.addPass(this.postprocessing.bokeh)
                        this.configPostProcessing(this.postprocessing.bokeh, postproc[i]["config"])
                        break;

                    default:
                        break;
                }
            }
            return true;
        }
    }

    //setta il cambio colore
    async ColorChanger(name) {
        var colore = null
        var colorCur = $(name).spectrum("get");
        if (typeof colorCur.toHex !== "undefined") {
            colore = colorCur.toHex();
        }

        $("name").spectrum("destroy");
        $(name).spectrum({
            color: colore,
            type: "component",
            showPalette: false,
            disabled: true,
            showButtons: false,
            allowEmpty: false,
            showAlpha: false

        });
        if (colore == null) {
            this.scene.traverse((child) => {
                if (child.isMesh && child.name == "Struttura") {
                    $(name).spectrum("set", child.material.color.getHexString());
                }
            });
        }


        $(name).off("dragstop.spectrum");


        $(name).on("dragstop.spectrum",(e, color) => {
            this.scene.traverse((child) =>  {
                if (child.isMesh && child.name == "Struttura") {
                    child.material.color.setHex("0x" + color.toHexString().substring(1));
                }

            });
        });

        if (colore != null) {
            $(name).trigger("dragstop.spectrum", [colorCur])
        }

        $(name).spectrum("enable");
    }

    //setta il loader per il logo
    async LogoChanger(logo) {

        var materialLogo = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            combine: THREE.MixOperation,
            reflectivity: 1,
            side: THREE.BackSide
        })

        var dimensionLogo = 0;

        this.scene.traverse((child) => {
            if (child.isMesh && child.name.substring(0, 4) == "Logo") {
                dimensionLogo = child.scale.x;
                child.material = materialLogo;
            }
        });
        var Cscene = this.scene;

        var LogoClone = logo.cloneNode(true);
        await logo.parentNode.replaceChild(LogoClone, logo);
        logo = LogoClone;
        logo.addEventListener("change", changeLogo);
        logo.dispatchEvent(new Event('change'));
        function changeLogo() {
            if (this.files != undefined && this.files.length != 0) {
                var file = this.files[0];
                var reader = new FileReader();
                reader.onloadend = function () {
                    let proporzione = 1;
                    const textureLoaded = new THREE.TextureLoader().load(reader.result, function (tex) {
                        proporzione = tex.image.height / tex.image.width;

                        materialLogo.map = textureLoaded;
                        materialLogo.opacity = 1;
                        textureLoaded.needsUpdate = true;
                        materialLogo.needsUpdate = true;
                        Cscene.traverse(function (child) {
                            if (child.isMesh && child.name.substring(0, 4) == "Logo") {
                                if (proporzione > 1)
                                    child.scale.set(dimensionLogo * 1 / proporzione, dimensionLogo, dimensionLogo * 1 / proporzione);
                                else
                                    child.scale.set(dimensionLogo, dimensionLogo * proporzione, dimensionLogo);
                            }
                        });
                    });
                }
                reader.readAsDataURL(file);
            }
        }
        return logo;
    }

    //Modifica i materiali con trasparenza prendendo un vettore che contiene il nome delle mesh e l'opacita da settargli 
    async changeMaterialOpacity(vec) {
        this.scene.traverse((child)=>{
            if (child.isMesh) {
                for (var i = 0; i < vec.length; i++) {
                    if (child.name == vec[i]["name"]) {
                        child.material.transparent = true;
                        child.material.opacity = vec[i]["value"];
                    }
                }

            }

        });
    }

    //toggle della debug mode
    toggleDebugMode() {
        debug = !debug;
    }

    async Framerate(delta){
        if(this.second>=1){
            var t=async ()=>{ console.log(this.frames);}
            t();
            
            if(this.frames<30)
            {
                this.wait++;
                if(this.wait>4){
                    this.innerWidth/=(30/this.frames)
                    this.innerHeight/=(30/this.frames)
                    
                    this.onWindowResize(this.camera,this.renderer,this.postprocessing)
                    this.wait=0;
                }
                
            }else{
                this.wait=0;
            }
            this.second=0;
            this.frames=0;
        }else{
            this.frames+=1;
            this.second+=delta
        }
        
    }

    //Fa partire il game loop
    start() {
        this.frames=0,this.second=0,this.wait=0;
        console.log(this.scene);
        this.onWindowResize(this.camera, this.renderer, this.postprocessing);
        this.postprocessing.composer.renderer.setAnimationLoop(async () => {
            // tell every animated object to tick forward one frame
            const delta =this.clock.getDelta();
            this.tick(delta);
            this.Framerate(delta)
            this.postprocessing.composer.render(this.clock.getDelta());
            
        });
    }

    //Stoppa il game loop
    stop() {
        this.renderer.setAnimationLoop(null);
    }

    //Cosa fa il game loop ad ogni tick;
    async tick(delta) {
        if (this.mixers.length != 0) {
            for (var i = 0; i < this.mixers.length; i++)
                this.mixers[i].update(delta);
        }
    }

    //pulisce la scena per l'inserimento di un altra(soppa anche il render per evitare problemi con le animazioni)
    clear() {
        this.stop();
        this.scene.remove.apply(this.scene, this.scene.children);
        this.scene.background = null;
        this.mixers.splice(0, this.mixers.length);
        this.sceneMeshes.splice(0, this.sceneMeshes.length);
        $("#picker").spectrum("hide");
    }

}



export { Mondo };