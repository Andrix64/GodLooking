//importa three.js
import * as THREE from '../../../three.js/build/three.module.js';

//importa i controlli orbitali
import { OrbitControls } from '../../../three.js/examples/jsm/controls/OrbitControls.js';

//importa i loader di modelli,texture e decompressori
import { GLTFLoader } from '../../../three.js/examples/jsm/loaders/GLTFLoader.js';
import { EXRLoader } from '../../../three.js/examples/jsm/loaders/EXRLoader.js';
import { DRACOLoader } from '../../../three.js/examples/jsm/loaders/DRACOLoader.js';

//importa il mapper dei riflessi hdr
import { RoughnessMipmapper } from '../../../three.js/examples/jsm/utils/RoughnessMipmapper.js';

//Importa necessario per post processing
import { EffectComposer } from '../../../three.js/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../../three.js/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from '../../../three.js/examples/jsm/postprocessing/BokehPass.js';
import { SAOPass } from '../../../three.js/examples/jsm/postprocessing/SAOPass.js';






class Mondo {
    constructor(container,camerapos,sceneColor) //Costruttore (setta le basi)
    {
        
        this.container = container;
        this.loadingscreen=undefined;
        this.loadingbar=undefined;
        this.postprocessing = {};
        this.camera= new THREE.PerspectiveCamera( 50, window.innerWidth / window.innerHeight ,0.01, 100 );
        this.camera.position.set(camerapos.x,camerapos.y,camerapos.z);

        this.controls=null;
        this.sceneMeshes = new Array();

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath( '../../three.js/examples/js/libs/draco/' );

        this.scene = new THREE.Scene();
        {
            if(sceneColor!=undefined)
                this.scene.background = new THREE.Color(sceneColor);
        }

        this.mixers = [];

        this.clock = new THREE.Clock();

        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.renderer.shadowMap.enabled = false;//SHADOWMAP
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;//SHADOWMAP TYPE

        this.container.appendChild( this.renderer.domElement );

        this.initPostprocessing()
        this.onWindowResize(this.camera,this.renderer,this.postprocessing);
    }

    SetLoadingScreen(loadscreen,loadbar){
        this.loadingscreen=loadscreen;
        this.loadingbar=loadbar;
    }

    //pathsOBJ è un oggetto che contiene i link agli oggetti e all'environment da aggiungere nella scena e la posizione x,y,z in cui posizionarli. ESEMPIO { "oggetti":[ { "path":"./link/Oggetto.gltf","position":{"x":0,"y":0,"z":0},"collide": true },.... ], "environment": "./link/Environment.exr" }
    async initScene(paths) 
    {
        if(this.loadingbar!=undefined)
        {
            this.loadingbar.style.width="5%";
        }

        const requests = paths["oggetti"].map((path) => { 
            return this.LoadObject(path["path"]);
        });

        var allReturn,posObj;

        if(this.loadingbar!=undefined)
        {
            this.loadingbar.style.width="25%";
        }

        if(paths["environment"]!=undefined){
            posObj=1

            allReturn=await Promise.all([
                this.LoadEquirectangular(paths["environment"]),
                requests,
            ]); 
    
            const pmremGenerator = new THREE.PMREMGenerator( this.renderer );
            const envMap = pmremGenerator.fromEquirectangular( allReturn[0] ).texture;
            const rt = new THREE.WebGLCubeRenderTarget(allReturn[0].image.height);
            rt.fromEquirectangularTexture(this.renderer, allReturn[0]);
            this.scene.background = rt;
            this.scene.environment = envMap;
            allReturn[0].dispose();
        }else{
            allReturn=await Promise.all([
                requests,
            ]); 
            posObj=0
        }
        if(this.loadingbar!=undefined)
        {
            this.loadingbar.style.width="50%";
        }

        var mix=this.mixers;
        var scena=this.scene;
        var meshscene=this.sceneMeshes
        for(var i=0;i<allReturn[posObj].length;i++)
        {
            await allReturn[posObj][i].then(function(result) {
                //ADD MIXER
                mix.push( new THREE.AnimationMixer( result.scene ))
                result.animations.forEach( ( clip ) => {
                    
                    mix[mix.length-1].clipAction( clip ).play();
            
                });
                
                //ADD SCENE
                if(paths["oggetti"][i]["collide"])
                {
                    result.scene.traverse( function ( child ) {
                        if ( child.isMesh ) {
                            meshscene.push(child);
                        }
                    } );
                }
                    
                result.scene.position.set(paths["oggetti"][i]["position"].x,paths["oggetti"][i]["position"].y,paths["oggetti"][i]["position"].z);
                scena.add(result.scene);
            });
        }

        if(this.loadingbar!=undefined)
        {
            this.loadingbar.style.width="100%";
        }
        if(this.loadingscreen!=undefined)
        {
            async function fadeout(load){
                load.style.opacity-=0.05;
                if(load.style.opacity>0){
                    setTimeout(function(){fadeout(load)}, 50);
                }else{
                    load.style.width="1px";
                    load.style.height="1px";
                }
            }

            fadeout(this.loadingscreen);
        }

    }

    //Setta il controller della telecamera prendendo il massimo e il minimo che la telecamera può zoomare
    SetCameraControl(zoomMin,zoomMax,target)
    {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.minDistance = zoomMin;
        this.controls.maxDistance = zoomMax;
        this.controls.maxPolarAngle = Math.PI / 2;
        this.controls.enablePan = true;
        if(target!=undefined)
            this.controls.target.set(target.x, target.y, target.x);
        else
            this.controls.target.set(0,0,0);

        this.controls.update();
    }

    //Aggiunge il listener per la collisione con la scena
    async CameraCollision()
    {
        //Variabili per collisione
        const raycaster = new THREE.Raycaster();
        let dir = new THREE.Vector3();
        let intersects = new Array();
        
        var con=this.controls,cam=this.camera,meshscene=this.sceneMeshes;
        //Quando la telecamera cambia posizione
        this.controls.addEventListener("change", function() {

            //collision detector
            raycaster.set(con.target, dir.subVectors(cam.position, con.target).normalize())
            intersects = raycaster.intersectObjects(meshscene, false);
            if (intersects.length > 0) {
                if (intersects[0].distance < con.target.distanceTo(cam.position)) {
                    cam.position.copy(intersects[0].point)
                }
            }
            
        })

        this.controls.update();
    }

    //Aggiunge il listener per il movimento consentito della telecamera prendendo il massimo e il minimo 
    async CameraMovement(MiPan,MaPan)
    {
        //variabili per spostamento
        var minPan = new THREE.Vector3( MiPan.x, MiPan.y, MiPan.z );
        var maxPan = new THREE.Vector3( MaPan.x, MaPan.y, MaPan.z );
        var _v = new THREE.Vector3();

        //Quando la telecamera cambia posizione
        var con=this.controls,cam=this.camera;
        this.controls.addEventListener("change", function() {
            //movimento camera
            _v.copy(con.target);
            con.target.clamp(minPan, maxPan);
            _v.sub(con.target);
            cam.position.sub(_v);
            
        })

        this.controls.update();
    }

    //Setta tutte le mesh in modo che possano dare e ricevere ombra
    async AllCastShadow()
    {
        this.scene.traverse( function ( child ) {
            if ( child.isMesh ) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }
    
    //Modifica i materiali con trasparenza prendendo due vettori che contengono il primo il nome delle mesh e il secondo l'opacita da settargli 
    async changeMaterialOpacity(name,opacity)
    { 
        this.scene.traverse( function ( child ) {
            if ( child.isMesh ) {
                for(var i=0;i<name.length;i++)
                {
                    if(child.name==name[i])
                    {
                        child.material.transparent=true;
                        child.material.opacity=opacity[i];
                    }
                }

            }

        } );
    }

    //setta come listener il resizer della finestra
    SetResizeFunction()
    {
        var Ccamera=this.camera,Crenderer=this.renderer,Cpostprocessing=this.postprocessing;
        var fun=this.onWindowResize;
        window.addEventListener( 'resize', function(){
            fun(Ccamera,Crenderer,Cpostprocessing)
        } );
    }

    //Sistema i render in base alla grandezza e ratio della finestra
    onWindowResize(Ccamera,Crenderer,Cpostprocessing) 
    {
        Ccamera.aspect = window.innerWidth / window.innerHeight;
        Ccamera.updateProjectionMatrix();
    
        Crenderer.setSize( window.innerWidth, window.innerHeight );
        Cpostprocessing.composer.setSize( window.innerWidth, window.innerHeight );
    
    }

    //setta i filtri postprocessing
    initPostprocessing() 
    {
        const renderPass = new RenderPass( this.scene, this.camera );
        const composer = new EffectComposer( this.renderer );
    
        composer.addPass( renderPass );
        
    
        this.postprocessing.composer = composer;
    }

    async addPostprocessing(){
    
        const bokehPass = new BokehPass( this.scene, this.camera, {
            focus: 1.3,
            aperture: 0.0005,
            maxblur: 0.015,
    
            width: window.innerWidth, 
            height: window.innerHeight
        } );
        const saoPass = new SAOPass( this.scene, this.camera, false, true );
        saoPass.params['output']=SAOPass.OUTPUT.Default;
        saoPass.params['saoBias']=1;
        saoPass.params['saoIntensity']=0.002;
        saoPass.params['saoScale']=1.5;
        saoPass.params['saoKernelRadius']=49;
        saoPass.params['saoMinResolution']=0;
        saoPass.params['saoBlur']=true;
        saoPass.params['saoBlurRadius']=53.8;
    
        this.postprocessing.composer.addPass( saoPass );
        this.postprocessing.composer.addPass( bokehPass );
        
        this.postprocessing.bokeh = bokehPass;
        this.postprocessing.saoPass =saoPass
    }

    //carica l'Equirectangular dal link
    async LoadEquirectangular(path)
    {
        const loader = new EXRLoader();
        loader.setDataType( THREE.UnsignedByteType )

        const texture = await Promise.all([
            loader.loadAsync(path),
        ]);
        return texture[0];
    }

    //carica gli oggetti dal link
    async LoadObject(path)
    {

        const loader = new GLTFLoader();
        loader.setDRACOLoader( this.dracoLoader );
    
        const object = await Promise.all([
            loader.loadAsync(path),
        ]);
        return object[0];
    }

    //setta il cambio colore
    ColorChanger(name){
        $(name).spectrum({
            type: "component",
            showPalette: false,
            disabled: true,
            showButtons: false,
            allowEmpty: false,
            showAlpha: false
        
        });

        var Cscene=this.scene;
        Cscene.traverse( function ( child ) {
            if ( child.isMesh && child.name=="Struttura") {
                console.log(child.material.color.getHexString())
                $(name).spectrum("set", child.material.color.getHexString()); 
            }
        } );
        
        
        
        $(name).on("dragstop.spectrum", function(e,color) {
            Cscene.traverse( function ( child ) {
                if ( child.isMesh && child.name=="Struttura") {
                    child.material.color.setHex("0x"+color.toHexString().substring(1)); 
                }
        
            } );
        });
        $(name).spectrum("enable");
    }

    //setta il loader per il logo
    LogoChanger(logo)
    {

        var materialLogo = new THREE.MeshBasicMaterial({
            transparent: true,
            opacity:0,
            combine:THREE.MixOperation,
            reflectivity:1,
            side : THREE.BackSide
        })

        var dimensionLogo=0;

        this.scene.traverse( function ( child ) {
            if ( child.isMesh  && child.name.substring(0,4)=="Logo")
            {
                dimensionLogo=child.scale.x;
                child.material=materialLogo;
            }
        });
        var Cscene=this.scene;
        logo.addEventListener("change", changeLogo);
        
        function changeLogo(){
            if(this!=undefined){
                var file = this.files[0];
                var reader = new FileReader();
                reader.onloadend = function() {
                    let proporzione=1;
                    const textureLoaded = new THREE.TextureLoader().load(reader.result, function ( tex ) {
                        proporzione=tex.image.height/tex.image.width;
                        console.log(dimensionLogo+" | "+tex.image.height+" | "+tex.image.width)
                        console.log(materialLogo)
        
                        materialLogo.map=textureLoaded;
                        materialLogo.opacity=1;
                        textureLoaded.needsUpdate=true;
                        materialLogo.needsUpdate=true;
                        Cscene.traverse( function ( child ) {
                            if ( child.isMesh && child.name.substring(0,4)=="Logo")
                            {
                                if(proporzione>1)
                                    child.scale.set(dimensionLogo*1/proporzione,child.scale.y,child.scale.z);
                                else
                                    child.scale.set(child.scale.x,dimensionLogo*proporzione,child.scale.z);
                            }
                        });
                    });
                }
                reader.readAsDataURL(file);
            }
        }
    }

    //Fa partire il game loop
    start() 
    {
        this.onWindowResize(this.camera,this.renderer,this.postprocessing);
        this.postprocessing.composer.renderer.setAnimationLoop(() => {
            // tell every animated object to tick forward one frame
            this.tick();

            // render a frame
            this.postprocessing.composer.render( this.clock.getDelta() );
        });
    }

    //Stoppa il game loop
    stop() 
    {
        this.renderer.setAnimationLoop(null);
    }

    //Cosa fa il game loop ad ogni tick;
    tick() 
    {
        const delta = this.clock.getDelta();
        if ( this.mixers.length!=0 ) {
            for(var i=0;i<this.mixers.length;i++)
                this.mixers[i].update( delta );
        }
    }
}



export { Mondo };