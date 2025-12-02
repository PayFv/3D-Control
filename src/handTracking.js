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
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
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

        // Detect "Two Fingers" (Victory / Peace sign)
        // Index (8) and Middle (12) are extended. Ring (16) and Pinky (20) are curled.
        // Thumb (4) can be anywhere.
        
        const isExtended = (tipIdx, pipIdx) => {
            // Simple check: tip is higher (lower y) than pip
            // Note: MediaPipe Y increases downwards.
            return hand[tipIdx].y < hand[pipIdx].y;
        };
        
        // More robust extended check using distance from wrist
        const dist = (idx) => Math.sqrt(
            Math.pow(hand[idx].x - wrist.x, 2) + 
            Math.pow(hand[idx].y - wrist.y, 2)
        );
        
        const indexExt = dist(8) > dist(6); // Tip vs PIP
        const middleExt = dist(12) > dist(10);
        const ringExt = dist(16) > dist(14);
        const pinkyExt = dist(20) > dist(18);
        
        // Victory: Index & Middle Extended, Ring & Pinky NOT Extended
        // Also check that index and middle are somewhat separated?
        
        let xPos = 0.5; // Center
        let isMoving = false;
        
        if (indexExt && middleExt && !ringExt && !pinkyExt) {
            isMoving = true;
            // Use the average X of index and middle tip
            xPos = (hand[8].x + hand[12].x) / 2;
            // Mirror it? Webcam is usually mirrored.
            // If user moves hand right (screen right), x increases.
            // We want object to move right.
            xPos = 1.0 - xPos; // Flip for mirrored feel if needed, or just xPos.
            // Usually webcam is mirrored, so moving hand "right" in real world moves it "left" on screen.
            // Let's assume standard mirror behavior.
        }

        this.onUpdate({
            tension: tension,
            closed: closed,
            isMoving: isMoving,
            xPos: xPos
        });
    }
}
