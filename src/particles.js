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
        
        // Initialize random positions
        for (let i = 0; i < this.count * 3; i++) {
            this.positions[i] = (Math.random() - 0.5) * 50;
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

        this.currentShape = 'random';
        this.setShape('heart'); // Default
    }

    update(time) {
        this.material.uniforms.uTime.value = time;
        
        // Smoothly interpolate positions if we were doing CPU morphing, 
        // but here we are doing shader morphing.
        // We need to update the 'position' attribute to be the OLD shape 
        // and 'target' to be the NEW shape when switching.
        // For now, let's just assume 'position' is the canonical source and we move it.
        
        // Actually, a better morphing strategy for this amount of particles:
        // Keep 'position' as the current state. Move particles towards 'target' every frame in JS.
        // This allows for interactive physics (hand repulsion) easily.
        
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
        
        // Map tension to expansion
        // Map closed to contraction or color intensity
        
        if (data.tension !== undefined) {
            // Smoothly update expansion
            const targetExpansion = data.tension;
            this.material.uniforms.uExpansion.value += (targetExpansion - this.material.uniforms.uExpansion.value) * 0.1;
        }
        
        if (data.closed !== undefined) {
            // Maybe shrink size when closed?
            const targetSize = 0.1 + (1.0 - data.closed) * 0.1; 
             // If closed (1), size is small. If open (0), size is big? 
             // Or vice versa. Let's make it pulse.
             // Actually, let's use closed to scale the whole object down.
             this.points.scale.setScalar(1.0 - data.closed * 0.5);
        }
    }

    setColor(hex) {
        this.material.uniforms.uColor.value.set(hex);
    }

    setShape(type) {
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
            default:
                this.generateRandom(targets);
        }
        
        // We don't set needsUpdate here because we read from it in the loop
        // But actually we write to it once here.
        // Wait, the loop reads from 'target' and writes to 'position'.
        // So we just need to update the 'target' array values.
        this.geometry.attributes.target.needsUpdate = true;
    }

    generateRandom(arr) {
        for (let i = 0; i < this.count * 3; i++) {
            arr[i] = (Math.random() - 0.5) * 50;
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
            arr[i3] = x * 0.5;
            arr[i3+1] = y * 0.5;
            arr[i3+2] = z;
        }
    }

    generateFlower(arr) {
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            const u = Math.random() * Math.PI * 2;
            const v = Math.random() * Math.PI;
            const r = 10 * (1 + 0.5 * Math.sin(5 * u) * Math.sin(v)); // 5 petals
            
            arr[i3] = r * Math.sin(v) * Math.cos(u);
            arr[i3+1] = r * Math.sin(v) * Math.sin(u);
            arr[i3+2] = r * Math.cos(v);
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
            
            arr[i3] = r * Math.sin(phi) * Math.cos(theta);
            arr[i3+1] = r * Math.sin(phi) * Math.sin(theta);
            arr[i3+2] = r * Math.cos(phi);
        }
        
        // Rings
        for (let i = sphereCount; i < this.count; i++) {
            const i3 = i * 3;
            const angle = Math.random() * Math.PI * 2;
            const dist = 12 + Math.random() * 10;
            
            arr[i3] = dist * Math.cos(angle);
            arr[i3+1] = (Math.random() - 0.5) * 0.5; // Thin ring
            arr[i3+2] = dist * Math.sin(angle);
            
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
                arr[i3] = r * Math.sin(phi) * Math.cos(theta);
                arr[i3+1] = r * Math.sin(phi) * Math.sin(theta) + 8; // Offset Y
                arr[i3+2] = r * Math.cos(phi);
            } else if (rand < 0.6) {
                // Body (Cylinder/Cone-ish)
                const h = (Math.random() - 0.5) * 10; // -5 to 5
                const r = 4 + (5 - Math.abs(h)) * 0.5; // Wider at bottom
                const theta = Math.random() * Math.PI * 2;
                
                arr[i3] = r * Math.cos(theta);
                arr[i3+1] = h; // Center
                arr[i3+2] = r * Math.sin(theta);
            } else {
                // Legs (Crossed - Torus segment?)
                // Let's just do a wide base
                const r = 6 + Math.random() * 6;
                const theta = Math.random() * Math.PI * 2;
                const h = -5 + (Math.random() - 0.5) * 2;
                
                arr[i3] = r * Math.cos(theta);
                arr[i3+1] = h;
                arr[i3+2] = r * Math.sin(theta);
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
            
            arr[i3] = r * Math.sin(phi) * Math.cos(theta) * streak;
            arr[i3+1] = r * Math.sin(phi) * Math.sin(theta) * streak;
            arr[i3+2] = r * Math.cos(phi) * streak;
        }
    }
}
