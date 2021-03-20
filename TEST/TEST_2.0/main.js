import { Mondo } from './class/modo.js';
const container = document.querySelector('#scene-container');

const world = new Mondo(container,{"x":-1,"y":0,"z":1},'lightblue');
//world.SetCameraControl(0.7,3);
world.SetCameraControl(0.7,30);
world.CameraCollision();
world.CameraMovement({"x":0,"y":-0.5,"z":0},{"x":0,"y": 0.7,"z":0});
await world.initScene({ "oggetti":[ { "path":"../gltf/Cittadino/Cittadina.gltf","position":{"x":0,"y":0,"z":0},"collide": true },{ "path":"../gltf/LowPolyTotem/Totem.gltf","position":{"x":0,"y":-0.13,"z":0} ,"collide": false} ], "environment": "../hdr/suburban_parking_area_2k.exr" })
world.changeMaterialOpacity(["Finestra","Glass"],[0.1 , 0.4]);
world.SetResizeFunction();
world.start();


/*
//importa three.js
import * as THREE from '../../three.js/build/three.module.js';

//importa i controlli orbitali
import { OrbitControls } from '../../three.js/examples/jsm/controls/OrbitControls.js';

//importa i loader di modelli,texture e decompressori
import { GLTFLoader } from '../../three.js/examples/jsm/loaders/GLTFLoader.js';
import { MTLLoader } from '../../three.js/examples/jsm/loaders/MTLLoader.js';
import { EXRLoader } from '../../three.js/examples/jsm/loaders/EXRLoader.js';
import { DRACOLoader } from '../../three.js/examples/jsm/loaders/DRACOLoader.js';

//importa il mapper dei riflessi hdr
import { RoughnessMipmapper } from '../../three.js/examples/jsm/utils/RoughnessMipmapper.js';

//Importa necessario per post processing
import { EffectComposer } from '../../three.js/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../../three.js/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from '../../three.js/examples/jsm/postprocessing/BokehPass.js';
import { SAOPass } from '../../three.js/examples/jsm/postprocessing/SAOPass.js';

//dichiarazione di variabili utili
let camera, scene, renderer;
let pmremGenerator;
let objectShown;
let allrend=0;
let materialLogo;
let dimensionLogo;
let mixer,clock;


//configurazione del color-picker
$('#color-picker').spectrum({
    type: "component",
    showPalette: false,
    disabled: true,
    showButtons: false,
    allowEmpty: false,
    showAlpha: false

});
$("#color-picker").on("dragstop.spectrum", function(e,color) {
    objectShown.traverse( function ( child ) {
        if ( child.isMesh ) {
            if(child.name=="Struttura")
                child.material.color.setHex("0x"+color.toHexString().substring(1)); 
        }

    } );
});

//Gestione inserimento logo
$("#file").on("change", changeLogo);

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
                
                objectShown.traverse( function ( child ) {
                    if ( child.isMesh ) {
                        if(child.name.substring(0,4)=="Logo")
                        {
                            if(proporzione<1)
                                child.scale.set(dimensionLogo,child.scale.y,dimensionLogo*proporzione);
                            else
                                child.scale.set(dimensionLogo*1/proporzione,child.scale.y,dimensionLogo);
                        }
                    }
                });
            });
        }
        reader.readAsDataURL(file);
    }
    
}


//Funzione principale
function init() {
    //posizionamento della finestra di render nella pagina

    //Clock per animazione
    

    //posizione camera

    //instanziamento Scena
    

    // Caricamento DracoLoader per la decompressione del file
    


    // Caricamento Oggetto
    const loader2 = new GLTFLoader().setPath( '../gltf/LowPolyTotem/' );
    loader2.setDRACOLoader( dracoLoader );

    loader2.load( 'Totem.gltf', function ( glb ) {
        document.getElementById("load2").innerHTML="Oggetto: 100% loaded";
        objectShown=glb.scene;

        glb.scene.scale.multiplyScalar(1);

        const roughnessMipmapper2 = new RoughnessMipmapper( renderer );

        scene.add( glb.scene );
        glb.scene.translateY(-0.13)

        materialLogo = new THREE.MeshBasicMaterial({
            // color: 0xffffff,
            transparent: true,
            opacity:0,
            combine:THREE.MixOperation,
            reflectivity:1
        })

        glb.scene.traverse( function ( child ) {
            if ( child.isMesh ) {
                roughnessMipmapper2.generateMipmaps( child.material );
                child.castShadow = true;
                child.receiveShadow = true;
                if(child.name=="Struttura")
                {
                    $("#color-picker").spectrum("set", child.material.color.getHexString());
                }
                    
                if(child.name=="Finestra")
                {
                    child.material.transparent=true;
                    child.material.opacity=0.1;
                }
                if(child.name.substring(0,4)=="Logo")
                {
                    dimensionLogo=child.scale.x;
                    child.material=materialLogo;
                }
                    

            }

        } );

        roughnessMipmapper2.dispose();

        endObjectRender();;
        allRendered();
    },
    function ( xhr ) {
        document.getElementById("load2").innerHTML="Oggetto: "+Math.floor( xhr.loaded / xhr.total * 50 )+"% loaded";
    },
    function ( error ) {
        document.getElementById("load2").innerHTML="An error happened loading the Object";

    } );

    
    // Caricamento EXR


    //Settings del render
    

    // Creazione composer per post-processing
    

    //instinziamento della mappa di riflessi hdr
    pmremGenerator = new THREE.PMREMGenerator( renderer );

    //settings del movimento telecamera
    const controls = new OrbitControls( camera, renderer.domElement );
    controls.minDistance = 0.7;
    controls.maxDistance = 3;
    controls.maxPolarAngle=Math.PI/2;
    controls.enablePan=true;
    controls.target.set( 0, 0, 0);
    
    //variabili per spostamento
    var minPan = new THREE.Vector3( 0, - 0.5, 0 );
    var maxPan = new THREE.Vector3( 0, 0.7, 0 );
    var _v = new THREE.Vector3();
    
    //Variabili per collisione
    const raycaster = new THREE.Raycaster();
    const sceneMeshes = new Array();
    let dir = new THREE.Vector3();
    let intersects = new Array();
    let intersectsOBJ= new Array();
    const raycasterBlur = new THREE.Raycaster();
    

    //Quando la telecamera cambia posizione
    controls.addEventListener("change", function() {
        //movimento camera
        _v.copy(controls.target);
        controls.target.clamp(minPan, maxPan);
        _v.sub(controls.target);
        camera.position.sub(_v);

        //collision detector
        dir.subVectors(camera.position, controls.target).normalize();

        raycaster.set(controls.target, dir.subVectors(camera.position, controls.target).normalize())
        intersects = raycaster.intersectObjects(sceneMeshes, false);
        if (intersects.length > 0) {
            if (intersects[0].distance < controls.target.distanceTo(camera.position)) {
                camera.position.copy(intersects[0].point)
            }
        }

        //depth of field
        raycasterBlur.setFromCamera(new THREE.Vector2( 0, 0 ),camera);
        if(objectShown!=undefined)
        {
            intersectsOBJ = raycasterBlur.intersectObjects( objectShown.children );
            if(intersectsOBJ[0]!=undefined)
                postprocessing.bokeh.uniforms[ "focus" ].value = intersectsOBJ[0].distance;
        }
        
    })

    controls.update();
    
    //Assegnamento del Listener "Click" ai pulsanti per cambiare la ToneMap
    let g;
    for(g=0;g<=4;g++){
        document.getElementById("TM"+g).addEventListener("click", CToneMap.bind(g));
    }
    allRendered();
}


//chiamata alla funzione principale
init();

//init del postprocessing


//funzione per la scomparsa della schermata di caricamento
function fadeout(){
    document.getElementById("cover").style.opacity-=0.05;
    if(document.getElementById("cover").style.opacity>0){
        setTimeout(fadeout, 50);
    }else{
        document.getElementById("cover").style.width="1px";
        document.getElementById("cover").style.height="1px";
        document.getElementById("info").style.opacity=1;
    }
}

//funzione di controllo se tutto è stato caricato
function allRendered(){
    allrend++;
    document.getElementById("progress-bar").style.width=allrend/4*100+"%";
    if(allrend==4){
        fadeout();
        window.addEventListener( 'resize', onWindowResize );
        onWindowResize();
        pmremGenerator.compileEquirectangularShader();
        render();
    }
}

//funzione per controllare se l'oggetto a cui cambiare colore è caricato
function endObjectRender(){
    $("#color-picker").spectrum("enable");
}

//funzione per cambiare tonemap
function CToneMap(){
    scene.traverse( function ( child ) {
        if ( child.isMesh ) {
            
            child.material.needsUpdate = true;

        }
    } );
    switch(this){
        case 1:
            renderer.toneMapping=THREE.LinearToneMapping;
            break;
        case 2:
            renderer.toneMapping=THREE.ReinhardToneMapping;
            break;
        case 3:
            renderer.toneMapping=THREE.CineonToneMapping;
            break;
        case 4:
            renderer.toneMapping=THREE.ACESFilmicToneMapping;
            break;
        default:
            renderer.toneMapping=THREE.NoToneMapping;
            break;
    }

    for(var f=0;f<=4;f++)
    {
        document.getElementById("TM"+f).style.fontWeight="normal";
    }
    document.getElementById("TM"+this).style.fontWeight="bold";
}

//funzione per il cambiamento di dimensione della finestra al resize di essa
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize( window.innerWidth, window.innerHeight );
    postprocessing.composer.setSize( window.innerWidth, window.innerHeight );

}

//funzione per il render generale
function render() {

    requestAnimationFrame( render );
    var delta = clock.getDelta();
    if ( mixer ) mixer.update( delta );

    postprocessing.composer.render( delta );
}
*/