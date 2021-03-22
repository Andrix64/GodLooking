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




var debug = false;

class Mondo {
    constructor(container, camerapos, sceneColor) //Costruttore (setta le basi)
    {
        this.container = container;
        this.loadingscreen = undefined;
        this.loadingbar = undefined;
        this.postprocessing = {};
        this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 100);
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

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.renderer.shadowMap.enabled = false;//SHADOWMAP
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;//SHADOWMAP TYPE

        this.container.appendChild(this.renderer.domElement);

        this.initPostprocessing()
        this.onWindowResize(this.camera, this.renderer, this.postprocessing);
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

    toggleDebugMode() {
        debug = !debug;
    }

    SetCameraListeners() {
        this.SetDepthOfField()
        this.CameraCollision();
        this.CameraMovement({ "x": 0, "y": -0.5, "z": 0 }, { "x": 0, "y": 0.7, "z": 0 });
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

    //pathsOBJ è un oggetto che contiene i link agli oggetti e all'environment da aggiungere nella scena e la posizione x,y,z in cui posizionarli. ESEMPIO { "oggetti":[ { "path":"./link/Oggetto.gltf","position":{"x":0,"y":0,"z":0},"collide": true },.... ], "environment": "./link/Environment.exr" }
    async initScene(paths) {
        if (this.loadingbar != undefined) {
            this.loadingbar.style.width = "5%";
        }

        const requests = paths["oggetti"].map((path) => {
            return this.LoadObject(path["path"]);
        });

        var allReturn, posObj;

        if (this.loadingbar != undefined) {
            this.loadingbar.style.width = "25%";
        }

        if (paths["environment"] != undefined) {
            posObj = 1

            allReturn = await Promise.all([
                this.LoadEquirectangular(paths["environment"]),
                requests,
            ]);
            if (allReturn[0] != 0) {
                const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
                const envMap = pmremGenerator.fromEquirectangular(allReturn[0]).texture;
                const rt = new THREE.WebGLCubeRenderTarget(allReturn[0].image.height);
                rt.fromEquirectangularTexture(this.renderer, allReturn[0]);
                if (this.scene.background == null) {
                    this.scene.background = rt;
                }
                this.scene.environment = envMap;
                allReturn[0].dispose();
            }

        } else {
            allReturn = await Promise.all([
                requests,
            ]);
            posObj = 0
        }
        if (this.loadingbar != undefined) {
            this.loadingbar.style.width = "50%";
        }

        var mix = this.mixers;
        var scena = this.scene;
        var meshscene = this.sceneMeshes
        var CexposeObj = this.exposeObj
        for (var i = 0; i < allReturn[posObj].length; i++) {
            await allReturn[posObj][i].then(function (result) {
                if (result != 0) {
                    //ADD MIXER
                    mix.push(new THREE.AnimationMixer(result.scene))
                    result.animations.forEach((clip) => {

                        mix[mix.length - 1].clipAction(clip).play();

                    });

                    //ADD SCENE
                    if (paths["oggetti"][i]["collide"]) {
                        result.scene.traverse(function (child) {
                            if (child.isMesh) {
                                meshscene.push(child);
                            }
                        });
                    }

                    //Oggetti che subiscono il raycast del depth of field
                    if (paths["oggetti"][i]["expose"]) {
                        result.scene.traverse(function (child) {
                            if (child.isMesh) {
                                CexposeObj.push(child);
                            }
                        });
                    }

                    result.scene.rotation.y = Math.PI / (180 / paths["oggetti"][i]["rotate"]);
                    result.scene.position.set(paths["oggetti"][i]["position"].x, paths["oggetti"][i]["position"].y, paths["oggetti"][i]["position"].z);
                    scena.add(result.scene);
                } else {
                    alert("Elemento " + i + " : Formato non supportato")
                }
            });


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

    //Setta il controller della telecamera prendendo il massimo e il minimo che la telecamera può zoomare
    SetCameraControl(zoomMin, zoomMax, target) {
        if (this.controls != null) {
            this.controls.dispose();
        }

        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = zoomMin;
        this.controls.maxDistance = zoomMax;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.enablePan = true;
        if (target != undefined)
            this.controls.target.set(target.x, target.y, target.x);
        else
            this.controls.target.set(0, 0, 0);

        this.controls.update();
    }

    //Aggiunge il listener per la collisione con la scena
    async CameraCollision() {
        //Variabili per collisione
        const raycaster = new THREE.Raycaster();
        let dir = new THREE.Vector3();
        let intersects = new Array();

        var con = this.controls, cam = this.camera, meshscene = this.sceneMeshes;
        //Quando la telecamera cambia posizione
        this.controls.addEventListener("change", function () {

            //collision detector
            if (!debug) {
                raycaster.set(con.target, dir.subVectors(cam.position, con.target).normalize())
                intersects = raycaster.intersectObjects(meshscene, false);
                if (intersects.length > 0) {
                    if (intersects[0].distance < con.target.distanceTo(cam.position)) {
                        cam.position.copy(intersects[0].point)
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
        var con = this.controls, cam = this.camera;
        this.controls.addEventListener("change", function () {
            //movimento camera
            if (!debug) {
                _v.copy(con.target);
                con.target.clamp(minPan, maxPan);
                _v.sub(con.target);
                cam.position.sub(_v);
            }
        })

        this.controls.update();
    }

    //Setta tutte le mesh in modo che possano dare e ricevere ombra
    async AllCastShadow() {
        this.scene.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }

    //Modifica i materiali con trasparenza prendendo un vettore che contiene il nome delle mesh e l'opacita da settargli 
    async changeMaterialOpacity(vec) {
        this.scene.traverse(function (child) {
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

    //setta come listener il resizer della finestra
    async SetResizeFunction() {
        var Ccamera = this.camera, Crenderer = this.renderer, Cpostprocessing = this.postprocessing;
        var fun = this.onWindowResize;
        window.addEventListener('resize', function () {
            fun(Ccamera, Crenderer, Cpostprocessing)
        });
    }

    //Sistema i render in base alla grandezza e ratio della finestra
    onWindowResize(Ccamera, Crenderer, Cpostprocessing) {
        Ccamera.aspect = window.innerWidth / window.innerHeight;
        Ccamera.updateProjectionMatrix();

        Crenderer.setSize(window.innerWidth, window.innerHeight);
        Cpostprocessing.composer.setSize(window.innerWidth, window.innerHeight);

    }

    //setta i filtri postprocessing
    initPostprocessing() {
        const renderPass = new RenderPass(this.scene, this.camera);
        const composer = new EffectComposer(this.renderer);

        composer.addPass(renderPass);


        this.postprocessing.composer = composer;

        const bokehPass = new BokehPass(this.scene, this.camera, {
            focus: 1.3,
            aperture: 0.0005,
            maxblur: 0.015,

            width: window.innerWidth,
            height: window.innerHeight
        });
        const saoPass = new SAOPass(this.scene, this.camera, false, true);
        saoPass.params['output'] = SAOPass.OUTPUT.Default;
        saoPass.params['saoBias'] = 1;
        saoPass.params['saoIntensity'] = 0.002;
        saoPass.params['saoScale'] = 1.5;
        saoPass.params['saoKernelRadius'] = 49;
        saoPass.params['saoMinResolution'] = 0;
        saoPass.params['saoBlur'] = true;
        saoPass.params['saoBlurRadius'] = 53.8;

        this.postprocessing.composer.addPass(saoPass);
        this.postprocessing.composer.addPass(bokehPass);

        this.postprocessing.bokeh = bokehPass;
        this.postprocessing.saoPass = saoPass;
    }

    //attiva/disattiva il postprocessing
    async togglePostProcessing() {
        if (this.postprocessing.composer.passes.length > 1) {
            this.postprocessing.composer.removePass(this.postprocessing.saoPass)
            this.postprocessing.composer.removePass(this.postprocessing.bokeh)
        } else {
            this.postprocessing.composer.addPass(this.postprocessing.saoPass)
            this.postprocessing.composer.addPass(this.postprocessing.bokeh)
        }

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
        var Cscene = this.scene;
        if (colore == null) {
            Cscene.traverse(function (child) {
                if (child.isMesh && child.name == "Struttura") {
                    $(name).spectrum("set", child.material.color.getHexString());
                }
            });
        }


        $(name).off("dragstop.spectrum");


        $(name).on("dragstop.spectrum", function (e, color) {
            Cscene.traverse(function (child) {
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

        this.scene.traverse(function (child) {
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

    //Fa partire il game loop
    start() {
        this.onWindowResize(this.camera, this.renderer, this.postprocessing);
        this.postprocessing.composer.renderer.setAnimationLoop(() => {
            // tell every animated object to tick forward one frame
            this.tick();

            // render a frame
            this.postprocessing.composer.render(this.clock.getDelta());
        });
    }

    //Stoppa il game loop
    stop() {
        this.renderer.setAnimationLoop(null);
    }

    //Cosa fa il game loop ad ogni tick;
    tick() {
        const delta = this.clock.getDelta();
        if (this.mixers.length != 0) {
            for (var i = 0; i < this.mixers.length; i++)
                this.mixers[i].update(delta);
        }
    }
}



export { Mondo };