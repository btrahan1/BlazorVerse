import { SceneManager } from './engine/SceneManager.js';
import { EntityManager } from './engine/EntityManager.js';
import { DriveController } from './engine/DriveController.js';
import { Serializer } from './engine/Serializer.js';
import { RaceManager } from './engine/RaceManager.js';
import { AIManager } from './engine/AIManager.js';
import { SpawnerManager } from './engine/SpawnerManager.js';

class BlazorVerseEngine {
    constructor() {
        this.sceneManager = new SceneManager();
        this.entityManager = new EntityManager();
        this.driveController = new DriveController();
        this.serializer = new Serializer();
        this.raceManager = new RaceManager();
        this.aiManager = new AIManager();
        this.spawnerManager = new SpawnerManager();
        this.dotNetRef = null;
    }

    async init(canvasId, dotNetRef) {
        this.dotNetRef = dotNetRef;
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.error("Canvas not found!");
            return;
        }

        // Initialize Subsystems
        await this.sceneManager.init(canvas, (mesh) => this.onMeshSelected(mesh));
        this.entityManager.init(this.sceneManager.scene, this.sceneManager.shadowGen);
        this.driveController.init(this.sceneManager.scene, this.sceneManager.camera, canvas);
        this.aiManager.init(this.sceneManager.scene, this.dotNetRef);
        this.spawnerManager.init(this.sceneManager.scene, this.entityManager);
        this.serializer.init(this.sceneManager, this.entityManager);

        this.sceneManager.onSelectCallback = this.onMeshSelected.bind(this);

        this.raceManager.init((time) => {
            this.dotNetRef.invokeMethodAsync("OnRaceFinished", time);
        });

        // Start Render Loop
        this.sceneManager.engine.runRenderLoop(() => {
            if (this.sceneManager.scene) {
                this.sceneManager.scene.render();
                this.driveController.update();
                this.entityManager.animate();
                this.aiManager.update();
                this.spawnerManager.update();
                this.raceManager.update();
            }
        });

        this.startStatsLoop();
        console.log("BlazorVerse Modular Engine Initialized ☀️");
    }

    // --- Blazor Interop Methods ---
    addShape(type) { this.entityManager.spawnRandom(type); }
    changeColor(id) { this.entityManager.changeColor(id); }
    resetPos(id) { this.entityManager.resetPos(id); }
    deleteMesh(id) { this.entityManager.deleteMesh(id); }

    setVehiclePower(value) { this.driveController.setPower(value); }
    playerAttack() { this.aiManager.playerAttack(); }
    updateMetadata(id, json) {
        const mesh = this.sceneManager.scene.getMeshByID(id);
        if (mesh) {
            const newMeta = JSON.parse(json);
            mesh.metadata = { ...mesh.metadata, ...newMeta };

            // Re-apply style if it was updated
            if (newMeta.style) {
                this.entityManager.applyStyle(mesh, newMeta.style);
            }
        }
    }
    setAIEnabled(enabled) {
        this.aiManager.setEnabled(enabled);
        this.spawnerManager.setEnabled(enabled); // Tie spawner to AI toggle for now
    }

    enterDriveMode(id) {
        const mesh = this.sceneManager.scene.getMeshByID(id);
        if (mesh) {
            this.driveController.enter(mesh);
            this.aiManager.setPlayer(mesh); // AI now tracks this vehicle/player
            this.raceManager.startRace(mesh, this.sceneManager.scene);
        }
    }

    exitDriveMode() {
        this.driveController.exit();
        this.aiManager.setPlayer(this.sceneManager.activeCamera === this.sceneManager.fpCamera ? this.sceneManager.fpCamera : null);
        this.raceManager.reset();
    }

    setGroundTexture(file) { this.sceneManager.setGroundTexture(file); }
    setAtmosphere(r, g, b, fog) { this.sceneManager.setAtmosphere(r, g, b, fog); }
    toggleFog(enabled) { this.sceneManager.toggleFog(enabled); }
    setEditorCameraMode(mode) {
        this.sceneManager.setEditorCameraMode(mode, document.getElementById("renderCanvas"));
    }

    exportScene() { return this.serializer.export(); }
    loadScene(json) { this.serializer.load(json); }

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    }

    // --- Internal Callbacks ---
    onMeshSelected(mesh) {
        if (!this.dotNetRef) return;

        // Bubble up to find the "logical" entity root (one with metadata)
        let root = mesh;
        while (root.parent && (!root.metadata || root.metadata.type === undefined)) {
            root = root.parent;
        }

        const pos = root.position;
        const metaJson = JSON.stringify(root.metadata || {});

        console.log(`🔍 Selected: ${root.name} (ID: ${root.id})`);

        this.dotNetRef.invokeMethodAsync("SelectObject",
            root.name, root.id,
            pos.x, pos.y, pos.z,
            metaJson
        ).catch(err => console.error(err));
    }

    startStatsLoop() {
        if (!this.dotNetRef) return;
        this._statsInterval = setInterval(() => {
            const stats = this.sceneManager.getStats();
            this.dotNetRef.invokeMethodAsync("UpdateStats",
                stats.fps, stats.x, stats.y, stats.z,
                stats.meshCount, stats.camType, stats.lights, stats.res, stats.verts
            ).catch(err => {
                // If interval is still running but C# is gone, clear it
                clearInterval(this._statsInterval);
            });

            const raceTime = this.raceManager.getCurrentTime();
            this.dotNetRef.invokeMethodAsync("UpdateTimer", raceTime);
        }, 100);
    }

    dispose() {
        console.log("Disposing Modular Engine...");
        if (this._statsInterval) clearInterval(this._statsInterval);
        this.driveController.dispose();
        this.sceneManager.dispose();
        this.dotNetRef = null;
    }
}

// Export to window so Blazor can find it
window.BabylonInterop = new BlazorVerseEngine();
