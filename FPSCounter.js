class FPSCounter {
    constructor() {
        this.lastTime = performance.now();
        this.frames = 0;
        this.lastFPS = 0;
        this.updateInterval = 1000; // Update FPS display every second
    }

    tick() {
        // Count this frame
        this.frames++;

        // Get current time
        const currentTime = performance.now();
        const elapsedTime = currentTime - this.lastTime;

        // If a second has passed, update the FPS count
        if (elapsedTime >= this.updateInterval) {
            this.lastFPS = Math.round(this.frames * 1000 / elapsedTime);
            this.frames = 0;
            this.lastTime = currentTime;
        }

        return this.lastFPS;
    }
}