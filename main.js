import * as THREE from 'three';
import { ParticleSystem } from './src/particles.js';
import { HandTracking } from './src/handTracking.js';
import { UI } from './src/ui.js';
import './style.css';

class App {
    constructor() {
        this.initScene();
        this.initParticles();
        this.initHandTracking();
        this.initUI();
        this.addEventListeners();
        this.animate();
    }

    initScene() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.z = 30;

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        document.body.appendChild(this.renderer.domElement);
    }

    initParticles() {
        this.particleSystem = new ParticleSystem(this.scene);
    }

    initHandTracking() {
        this.handTracking = new HandTracking((data) => {
            // data contains { tension, closed, handedness }
            this.particleSystem.updateHandInput(data);
            if (this.ui) {
                this.ui.updateDebug(data);
            }
        });
        this.handTracking.start();
    }

    initUI() {
        this.ui = new UI(this.particleSystem);
    }

    addEventListeners() {
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }

    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        const time = performance.now() * 0.001;
        this.particleSystem.update(time);
        
        this.renderer.render(this.scene, this.camera);
    }
}

new App();
