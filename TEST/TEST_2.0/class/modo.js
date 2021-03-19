class Mondo {
    constructor(container) {
        this.container = container;//const container = document.querySelector('#scene-container');
    }

    initScene() {
        this.camera= new THREE.PerspectiveCamera( 40, 1,0.01, 1000 );
        this.camera.position.set(-1,0,1);

        this.scene = new THREE.Scene();
        {
            const color = 'lightblue';
            scene.background = new THREE.Color(color);
        }
        this.clock = new THREE.Clock();

        this.renderer = new THREE.WebGLRenderer( { antialias: true } );
        this.renderer.setPixelRatio( window.devicePixelRatio );

        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;
        this.renderer.outputEncoding = THREE.sRGBEncoding;

        this.renderer.shadowMap.enabled = false;//SHADOWMAP
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;//SHADOWMAP TYPE

        this.container.appendChild( this.renderer.domElement );
    }
}