import { HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export class HandTracking {
    constructor(onUpdate) {
        this.onUpdate = onUpdate;
        this.video = document.createElement('video');
        this.video.autoplay = true;
        this.video.playsInline = true;
        this.lastVideoTime = -1;
        this.results = undefined;
    }

    async start() {
        try {
            const vision = await FilesetResolver.forVisionTasks(
                'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
            );
            
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });

            await this.setupCamera();
            this.predictWebcam();
        } catch (error) {
            console.error("Error initializing hand tracking:", error);
            document.getElementById('hand-status').innerText = "Error: " + error.message;
        }
    }

    async setupCamera() {
        const constraints = {
            video: {
                width: 640,
                height: 480
            }
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.video.srcObject = stream;
        
        return new Promise((resolve) => {
            this.video.onloadedmetadata = () => {
                this.video.play();
                resolve();
            };
        });
    }

    predictWebcam() {
        let startTimeMs = performance.now();
        
        if (this.lastVideoTime !== this.video.currentTime) {
            this.lastVideoTime = this.video.currentTime;
            this.results = this.handLandmarker.detectForVideo(this.video, startTimeMs);
        }

        if (this.results && this.results.landmarks) {
            this.processLandmarks(this.results.landmarks);
        }

        window.requestAnimationFrame(this.predictWebcam.bind(this));
    }

    processLandmarks(landmarks) {
        if (landmarks.length === 0) {
            document.getElementById('hand-status').innerText = "No hands detected";
            // Decay values if no hands?
            this.onUpdate({ tension: 0, closed: 0 });
            return;
        }

        document.getElementById('hand-status').innerText = `Hands detected: ${landmarks.length}`;

        // Process the first hand (or average of both)
        const hand = landmarks[0];
        
        // Calculate "Closed" state (Fist)
        // Check distance between fingertips and wrist/palm
        // Wrist is 0. Tips are 4, 8, 12, 16, 20.
        const wrist = hand[0];
        const tips = [4, 8, 12, 16, 20];
        
        let totalDist = 0;
        tips.forEach(tipIdx => {
            const tip = hand[tipIdx];
            const dist = Math.sqrt(
                Math.pow(tip.x - wrist.x, 2) +
                Math.pow(tip.y - wrist.y, 2) +
                Math.pow(tip.z - wrist.z, 2)
            );
            totalDist += dist;
        });
        
        // Normalize distance. 
        // Open hand avg dist is roughly 0.3 - 0.5 depending on camera distance.
        // Closed hand is < 0.2.
        // This is rough and depends on Z distance, but let's try relative to palm size.
        // Palm size: distance between 0 and 5, 0 and 17.
        
        const palmSize = Math.sqrt(
            Math.pow(hand[0].x - hand[5].x, 2) +
            Math.pow(hand[0].y - hand[5].y, 2)
        );
        
        const normalizedOpenness = (totalDist / 5) / palmSize;
        
        // Heuristic: > 2.0 is open, < 1.0 is closed
        const closed = Math.max(0, Math.min(1, 1.0 - (normalizedOpenness - 0.8) / 1.5));
        
        // Calculate "Tension"
        // Spread between fingers?
        // Distance between index tip (8) and pinky tip (20)
        const spread = Math.sqrt(
            Math.pow(hand[8].x - hand[20].x, 2) +
            Math.pow(hand[8].y - hand[20].y, 2)
        );
        
        const tension = Math.min(1, spread / (palmSize * 3)); // Normalize

        this.onUpdate({
            tension: tension,
            closed: closed
        });
    }
}
