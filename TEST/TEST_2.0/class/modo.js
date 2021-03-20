//importa three.js
import * as THREE from '../../../three.js/build/three.module.js';

//importa i controlli orbitali
import { OrbitControls } from '../../../three.js/examples/jsm/controls/OrbitControls.js';

//importa i loader di modelli,texture e decompressori
import { GLTFLoader } from '../../../three.js/examples/jsm/loaders/GLTFLoader.js';
import { MTLLoader } from '../../../three.js/examples/jsm/loaders/MTLLoader.js';
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
    constructor(container) {
        this.container = container;
        this.postprocessing = {};
        this.camera= new THREE.PerspectiveCamera( 40, 1,0.01, 1000 );
        this.camera.position.set(-1,0,1);

        

        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath( '../../../three.js/examples/js/libs/draco/' );

        this.scene = new THREE.Scene();
        {
            const color = 'lightblue';
            this.scene.background = new THREE.Color(color);
        }

        this.mixer = new THREE.AnimationMixer( this.scene );

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
        this.initScene()
    }

    async initScene() {
        const paths=["../gltf/Cittadino/Cittadina.gltf","../gltf/LowPolyTotem/Totem.gltf"]//oggetti da caricare

        const requests = paths.map((path) => { 
            return this.LoadObject(path) // Async function to send the mail.
        })
        const objects= await Promise.all(requests);
        console.log(objects);
        for(var i=0;i<objects.length;i++){
            this.scene.add(objects[i].scene);
        }

        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.postprocessing.composer.setSize( window.innerWidth, window.innerHeight );
        this.render();
    }

    initPostprocessing() {
        const renderPass = new RenderPass( this.scene, this.camera );
    
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
        const composer = new EffectComposer( this.renderer );
    
        composer.addPass( renderPass );
        composer.addPass( saoPass );
        composer.addPass( bokehPass );
        
    
        this.postprocessing.composer = composer;
        this.postprocessing.bokeh = bokehPass;
        this.postprocessing.saoPass =saoPass
    }

    LoadEquirectangular(path){

        new EXRLoader()
        .setDataType( THREE.UnsignedByteType )
        .load( '../hdr/suburban_parking_area_2k.exr', function ( texture ) {
            const envMap = pmremGenerator.fromEquirectangular( texture ).texture;
            const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
              rt.fromEquirectangularTexture(renderer, texture);
            scene.background = rt;

            scene.environment = envMap;

            texture.dispose();
            pmremGenerator.dispose();
            allRendered();

        },
        function ( xhr ) {
            document.getElementById("load3").innerHTML="EXR: "+Math.floor( xhr.loaded / xhr.total * 100 )+"% loaded";
        },
        function ( error ) {
            document.getElementById("load3").innerHTML="An error happened loading EXR";

        } );
        
    }

    async LoadObject(path){

        const loader = new GLTFLoader();
        loader.setDRACOLoader( this.dracoLoader );
    
        const object = await Promise.all([
            loader.loadAsync(path),
        ]);
        console.log(object[0]);
    
        
        object[0].animations.forEach( ( clip ) => {
    
            this.mixer.clipAction( clip ).play();
    
        } );
        
    
        return object[0];
    }

    render() {
        var delta = this.clock.getDelta();
        if ( this.mixer ) this.mixer.update( delta );

        this.postprocessing.composer.render( delta );
    }
}



export { Mondo };