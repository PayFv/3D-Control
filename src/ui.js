export class UI {
    constructor(particleSystem) {
        this.particleSystem = particleSystem;
        this.container = document.getElementById('ui-container');
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="panel">
                <h2>Templates</h2>
                <div class="btn-grid">
                    <button data-shape="heart">Heart</button>
                    <button data-shape="flower">Flower</button>
                    <button data-shape="saturn">Saturn</button>
                    <button data-shape="buddha">Buddha</button>
                    <button data-shape="fireworks">Fireworks</button>
                </div>
                <div class="input-group" style="margin-top: 10px; display: flex; gap: 5px;">
                    <input type="text" id="text-input" placeholder="Enter text..." style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); background: rgba(255,255,255,0.1); color: white;">
                    <button id="text-btn">Go</button>
                </div>
            </div>
            
            <div class="panel">
                <h2>Color</h2>
                <input type="color" id="color-picker" value="#ffffff">
            </div>

            <div class="panel" id="debug-panel">
                <h2>Debug Info</h2>
                <div class="debug-item">
                    <span>Tension:</span>
                    <span id="debug-tension">0.00</span>
                </div>
                <div class="debug-item">
                    <span>Closed:</span>
                    <span id="debug-closed">0.00</span>
                </div>
                <div class="debug-item">
                    <span>Status:</span>
                    <span id="debug-status">Waiting...</span>
                </div>
                <div class="debug-item">
                    <span>Move X:</span>
                    <span id="debug-move">0.00</span>
                </div>
            </div>
        `;

        this.setupListeners();
    }

    updateDebug(data) {
        const tensionEl = document.getElementById('debug-tension');
        const closedEl = document.getElementById('debug-closed');
        const statusEl = document.getElementById('debug-status');
        const moveEl = document.getElementById('debug-move');

        if (tensionEl) tensionEl.innerText = data.tension.toFixed(2);
        if (closedEl) closedEl.innerText = data.closed.toFixed(2);
        if (moveEl) moveEl.innerText = data.isMoving ? `${data.xPos.toFixed(2)}, ${data.yPos.toFixed(2)}` : "OFF";
        
        // Infer status
        if (statusEl) {
            if (data.isMoving) statusEl.innerText = "Moving (Victory)";
            else if (data.closed > 0.8) statusEl.innerText = "Closed (Shrink)";
            else if (data.tension > 0.5) statusEl.innerText = "Tension (Expand)";
            else statusEl.innerText = "Neutral";
        }
    }

    setupListeners() {
        const buttons = this.container.querySelectorAll('button');
        buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Remove active class from all
                buttons.forEach(b => b.classList.remove('active'));
                // Add to clicked
                e.target.classList.add('active');
                
                const shape = e.target.dataset.shape;
                this.particleSystem.setShape(shape);
            });
        });

        const textBtn = document.getElementById('text-btn');
        const textInput = document.getElementById('text-input');
        
        textBtn.addEventListener('click', () => {
            const text = textInput.value;
            if (text) {
                // Remove active from others
                buttons.forEach(b => b.classList.remove('active'));
                textBtn.classList.add('active');
                this.particleSystem.setShape('text', text);
            }
        });

        const colorPicker = document.getElementById('color-picker');
        colorPicker.addEventListener('input', (e) => {
            this.particleSystem.setColor(e.target.value);
        });
    }
}
