export class RaceManager {
    constructor() {
        this.state = "IDLE"; // IDLE, RACING, FINISHED
        this.startTime = 0;
        this.endTime = 0;
        this.finishLineMesh = null;
        this.carMesh = null;
        this.onRaceFinish = null; // Callback to C#
    }

    init(onRaceFinishCallback) {
        this.onRaceFinish = onRaceFinishCallback;
    }

    // Called when the user clicks "Drive"
    startRace(carMesh, scene) {
        this.carMesh = carMesh;
        
        // Find the finish line (we'll name it "finish_line" in the editor)
        this.finishLineMesh = scene.meshes.find(m => m.metadata && m.metadata.type === "finish");

        if (!this.finishLineMesh) {
            console.warn("No finish line found! Just driving freely.");
            return;
        }

        this.state = "RACING";
        this.startTime = Date.now();
        console.log("🏁 Race Started!");
    }

    update() {
        if (this.state !== "RACING" || !this.carMesh || !this.finishLineMesh) return;

        // Check for intersection
        if (this.carMesh.intersectsMesh(this.finishLineMesh, false)) {
            this.finishRace();
        }
    }

    finishRace() {
        this.state = "FINISHED";
        this.endTime = Date.now();
        const duration = (this.endTime - this.startTime) / 1000;
        
        console.log(`🏁 Finished! Time: ${duration.toFixed(2)}s`);
        
        if (this.onRaceFinish) {
            this.onRaceFinish(duration);
        }
    }

    getCurrentTime() {
        if (this.state === "IDLE") return 0;
        if (this.state === "FINISHED") return (this.endTime - this.startTime) / 1000;
        return (Date.now() - this.startTime) / 1000;
    }

    reset() {
        this.state = "IDLE";
        this.carMesh = null;
        this.finishLineMesh = null;
    }
}
