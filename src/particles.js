import * as THREE from 'three';

export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.count = 40000; // Increased from 20000
        this.geometry = new THREE.BufferGeometry();
        this.positions = new Float32Array(this.count * 3);
        this.targetPositions = new Float32Array(this.count * 3);
        this.colors = new Float32Array(this.count * 3);
        this.randoms = new Float32Array(this.count); // Add randomness attribute
        
        // Base scale factor for mobile
        this.baseScale = window.innerWidth < 600 ? 0.5 : 1.0;
        
        // Initialize random positions
        for (let i = 0; i < this.count * 3; i++) {
            this.positions[i] = (Math.random() - 0.5) * 50 * this.baseScale;
            this.targetPositions[i] = this.positions[i];
            this.colors[i] = 1.0; // White initially
        }
        
        for (let i = 0; i < this.count; i++) {
            this.randoms[i] = Math.random();
        }

        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
        this.geometry.setAttribute('target', new THREE.BufferAttribute(this.targetPositions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
        this.geometry.setAttribute('aRandom', new THREE.BufferAttribute(this.randoms, 1));

        this.material = new THREE.ShaderMaterial({
            vertexShader: `
                uniform float uTime;
                uniform float uMix;
                uniform float uSize;
                uniform float uExpansion;
                uniform vec3 uColor;
                
                attribute vec3 target;
                attribute float aRandom;
                varying vec3 vColor;

                void main() {
                    vColor = uColor;
                    
                    vec3 pos = mix(position, target, uMix);
                    
                    // Expansion effect based on hand tension
                    vec3 dir = normalize(pos);
                    // Exaggerated expansion with randomness
                    // Base expansion * (constant + random factor)
                    float expansionFactor = 30.0 + aRandom * 40.0; 
                    pos += dir * uExpansion * expansionFactor;

                    // Add some noise movement
                    pos.x += sin(uTime * 2.0 + aRandom * 10.0) * 0.1;
                    pos.y += cos(uTime * 1.5 + aRandom * 10.0) * 0.1;

                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    gl_PointSize = uSize * (300.0 / -mvPosition.z) * (0.8 + aRandom * 0.5);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                
                void main() {
                    float r = distance(gl_PointCoord, vec2(0.5));
                    if (r > 0.5) discard;
                    
                    float glow = 1.0 - (r * 2.0);
                    glow = pow(glow, 1.5);
                    
                    gl_FragColor = vec4(vColor, glow);
                }
            `,
            uniforms: {
                uTime: { value: 0 },
                uMix: { value: 0 }, // 0 = start, 1 = target (used for transition)
                uSize: { value: 0.1 },
                uExpansion: { value: 0 },
                uColor: { value: new THREE.Color('#ffffff') }
            },
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        this.points = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.points);

        this.currentShape = 'flower';
        this.setShape('flower'); // Default
    }

    update(time) {
        this.material.uniforms.uTime.value = time;
        
        const positions = this.geometry.attributes.position.array;
        const targets = this.geometry.attributes.target.array;
        
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            // Lerp towards target
            positions[i3] += (targets[i3] - positions[i3]) * 0.05;
            positions[i3+1] += (targets[i3+1] - positions[i3+1]) * 0.05;
            positions[i3+2] += (targets[i3+2] - positions[i3+2]) * 0.05;
        }
        
        this.geometry.attributes.position.needsUpdate = true;
    }

    updateHandInput(data) {
        // data.tension: 0 to 1 (hand open/stretched)
        // data.closed: 0 to 1 (hand closed)
        
        if (data.tension !== undefined) {
            // Remap tension: ignore values below 0.2 (noise floor)
            // 0.15 should result in 0 expansion
            let t = Math.max(0, data.tension - 0.2);
            // Rescale 0.0-0.8 to 0.0-1.0
            t = t * 1.25;
            
            // Disable expansion if moving (Victory gesture)
            if (data.isMoving) {
                t = 0;
            }
            
            const targetExpansion = t;
            this.material.uniforms.uExpansion.value += (targetExpansion - this.material.uniforms.uExpansion.value) * 0.1;
        }
        
        if (data.closed !== undefined) {
             // If closed is 0.65, we want it to be somewhat small, but maybe not fully compressed.
             // But if the user says "image not restored", maybe they mean it's stuck in a scaled state?
             // If closed is high, scale is low.
             // If closed is 0.65, scale is 1 - 0.325 = 0.675.
             // If they open hand, closed goes to 0, scale goes to 1.
             // Maybe the issue is that 0.65 is "neutral" for them? 
             // Let's assume < 0.2 is open, > 0.8 is closed.
             // Let's remap closed too.
             
             let c = Math.max(0, data.closed - 0.3); // Ignore low values
             // If c is 0 (original closed 0.3), scale is 1.
             // If c is 0.7 (original closed 1.0), scale is 0.5.
             
             // Disable shrinking if moving (Victory gesture)
             if (data.isMoving) {
                 c = 0;
             }
             
             this.points.scale.setScalar(1.0 - c * 0.5);
        }
        
        if (data.isMoving) {
            // Map 0..1 to -20..20 for X
            const targetX = (data.xPos - 0.5) * 40;
            // Map 0..1 to 15..-15 for Y (inverted because screen Y is down)
            // 0 (top) -> 15 (up)
            // 1 (bottom) -> -15 (down)
            const targetY = -(data.yPos - 0.5) * 30; 
            
            // Smoothly move
            this.points.position.x += (targetX - this.points.position.x) * 0.1;
            this.points.position.y += (targetY - this.points.position.y) * 0.1;
        } else {
            // Return to center? Or stay?
            // "跟着左右移动" implies it follows the hand. If hand stops/changes gesture, maybe it stays or returns.
            // Let's make it return to center when not gesturing, for cleaner UX.
            this.points.position.x += (0 - this.points.position.x) * 0.05;
            this.points.position.y += (0 - this.points.position.y) * 0.05;
        }
    }

    setColor(hex) {
        this.material.uniforms.uColor.value.set(hex);
    }

    setShape(type, text = '') {
        this.currentShape = type;
        const targets = this.geometry.attributes.target.array;
        
        switch (type) {
            case 'heart':
                this.generateHeart(targets);
                break;
            case 'flower':
                this.generateFlower(targets);
                break;
            case 'saturn':
                this.generateSaturn(targets);
                break;
            case 'buddha':
                this.generateBuddha(targets);
                break;
            case 'fireworks':
                this.generateFireworks(targets);
                break;
            case 'text':
                this.generateText(targets, text);
                break;
            default:
                this.generateRandom(targets);
        }
        
        this.geometry.attributes.target.needsUpdate = true;
    }

    generateText(arr, text) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 100;
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'white';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        const validPixels = [];
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                if (data[(y * canvas.width + x) * 4] > 128) {
                    validPixels.push({x, y});
                }
            }
        }
        
        if (validPixels.length === 0) {
            this.generateRandom(arr);
            return;
        }
        
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            const pixel = validPixels[Math.floor(Math.random() * validPixels.length)];
            
            // Map pixel to 3D space
            // x: 0-200 -> -20 to 20
            // y: 0-100 -> 10 to -10 (flip y)
            
            arr[i3] = (pixel.x / canvas.width - 0.5) * 40 * this.baseScale;
            arr[i3+1] = -(pixel.y / canvas.height - 0.5) * 20 * this.baseScale;
            arr[i3+2] = (Math.random() - 0.5) * 2 * this.baseScale; // Thin depth
        }
    }

    generateRandom(arr) {
        for (let i = 0; i < this.count * 3; i++) {
            arr[i] = (Math.random() - 0.5) * 50 * this.baseScale;
        }
    }

    generateHeart(arr) {
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            // Heart formula
            const t = Math.random() * Math.PI * 2;
            const u = Math.random() * Math.PI; // sphere distribution-ish
            
            // Better heart shape
            // x = 16sin^3(t)
            // y = 13cos(t) - 5cos(2t) - 2cos(3t) - cos(4t)
            // z = variation
            
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.random() * Math.PI;
            
            // 3D Heart approximation
            const x = 16 * Math.pow(Math.sin(phi), 3);
            const y = 13 * Math.cos(phi) - 5 * Math.cos(2*phi) - 2 * Math.cos(3*phi) - Math.cos(4*phi);
            const z = (Math.random() - 0.5) * 10; 
            
            // Scale down
            arr[i3] = x * 0.5 * this.baseScale;
            arr[i3+1] = y * 0.5 * this.baseScale;
            arr[i3+2] = z * this.baseScale;
        }
    }

    generateFlower(arr) {
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI;
            const r = 10 * (1 + 0.5 * Math.sin(5 * u) * Math.sin(v)); // 5 petals
            
            arr[i3] = r * Math.sin(v) * Math.cos(u) * this.baseScale;
            arr[i3+1] = r * Math.sin(v) * Math.sin(u) * this.baseScale;
            arr[i3+2] = r * Math.cos(v) * this.baseScale;
        }
    }

    generateSaturn(arr) {
        const ringCount = Math.floor(this.count * 0.7);
        const sphereCount = this.count - ringCount;
        
        // Sphere
        for (let i = 0; i < sphereCount; i++) {
            const i3 = i * 3;
            const r = 8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            arr[i3] = r * Math.sin(phi) * Math.cos(theta) * this.baseScale;
            arr[i3+1] = r * Math.sin(phi) * Math.sin(theta) * this.baseScale;
            arr[i3+2] = r * Math.cos(phi) * this.baseScale;
        }
        
        // Rings
        for (let i = sphereCount; i < this.count; i++) {
            const i3 = i * 3;
            const angle = Math.random() * Math.PI * 2;
            const dist = 12 + Math.random() * 10;
            
            arr[i3] = dist * Math.cos(angle) * this.baseScale;
            arr[i3+1] = (Math.random() - 0.5) * 0.5 * this.baseScale; // Thin ring
            arr[i3+2] = dist * Math.sin(angle) * this.baseScale;
            
            // Tilt the ring
            const x = arr[i3];
            const y = arr[i3+1];
            const z = arr[i3+2];
            
            // Rotate around X axis
            const tilt = 0.4;
            arr[i3] = x;
            arr[i3+1] = y * Math.cos(tilt) - z * Math.sin(tilt);
            arr[i3+2] = y * Math.sin(tilt) + z * Math.cos(tilt);
        }
    }

    generateBuddha(arr) {
        // Procedural "meditating figure" approximation
        // Head, Body, Legs
        
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            const rand = Math.random();
            
            if (rand < 0.2) {
                // Head (Sphere at top)
                const r = 3;
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                arr[i3] = r * Math.sin(phi) * Math.cos(theta) * this.baseScale;
                arr[i3+1] = (r * Math.sin(phi) * Math.sin(theta) + 8) * this.baseScale; // Offset Y
                arr[i3+2] = r * Math.cos(phi) * this.baseScale;
            } else if (rand < 0.6) {
                // Body (Cylinder/Cone-ish)
                const h = (Math.random() - 0.5) * 10; // -5 to 5
                const r = 4 + (5 - Math.abs(h)) * 0.5; // Wider at bottom
                const theta = Math.random() * Math.PI * 2;
                
                arr[i3] = r * Math.cos(theta) * this.baseScale;
                arr[i3+1] = h * this.baseScale; // Center
                arr[i3+2] = r * Math.sin(theta) * this.baseScale;
            } else {
                // Legs (Crossed - Torus segment?)
                // Let's just do a wide base
                const r = 6 + Math.random() * 6;
                const theta = Math.random() * Math.PI * 2;
                const h = -5 + (Math.random() - 0.5) * 2;
                
                arr[i3] = r * Math.cos(theta) * this.baseScale;
                arr[i3+1] = h * this.baseScale;
                arr[i3+2] = r * Math.sin(theta) * this.baseScale;
            }
        }
    }

    generateFireworks(arr) {
        // Explosion from center
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            const r = Math.random() * 20;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            // Add some trails/streaks
            const streak = Math.random();
            
            arr[i3] = r * Math.sin(phi) * Math.cos(theta) * streak * this.baseScale;
            arr[i3+1] = r * Math.sin(phi) * Math.sin(theta) * streak * this.baseScale;
            arr[i3+2] = r * Math.cos(phi) * streak * this.baseScale;
        }
    }
}
