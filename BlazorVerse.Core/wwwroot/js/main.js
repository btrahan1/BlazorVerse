import { SceneManager } from './engine/SceneManager.js';
import { EntityManager } from './engine/EntityManager.js';
import { DriveController } from './engine/DriveController.js';
import { Serializer } from './engine/Serializer.js';
import { RaceManager } from './engine/RaceManager.js';
import { AIManager } from './engine/AIManager.js';
import { SpawnerManager } from './engine/SpawnerManager.js';
import { CombatManager } from './engine/CombatManager.js';
import { DashboardManager } from './engine/DashboardManager.js';

class BlazorVerseEngine {
    constructor() {
        this.sceneManager = new SceneManager();
        this.entityManager = new EntityManager();
        this.driveController = new DriveController();
        this.serializer = new Serializer();
        this.raceManager = new RaceManager();
        this.aiManager = new AIManager();
        this.spawnerManager = new SpawnerManager();
        this.combatManager = new CombatManager();
        this.dashboardManager = new DashboardManager();
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
        this.sceneManager.onSelectCallback = this.onMeshSelected.bind(this);
        this.dashboardManager.init(this.sceneManager.scene);
        this.combatManager.init(this.sceneManager.scene);
        this.aiManager.init(this.sceneManager.scene, this.dotNetRef, this.combatManager);
        this.spawnerManager.init(this.sceneManager.scene, this.entityManager);

        this.entityManager.init(this.sceneManager.scene, this.sceneManager.shadowGen, this.combatManager, this.dashboardManager);

        // Load asset manifest for smart resolution
        fetch('_content/BlazorVerse.Core/data/assets.json')
            .then(r => r.ok ? r.json() : fetch('/data/assets.json').then(r2 => r2.json()))
            .then(assets => this.entityManager.setManifest(assets))
            .catch(err => console.warn("Could not load asset manifest, falling back to guessing logic.", err));

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
                this.combatManager.update();
                this.raceManager.update();
            }
        });

        this.startStatsLoop();
        console.log("BlazorVerse Modular Engine Initialized ☀️");
    }

    // --- Blazor Interop Methods ---
    addShape(type) {
        const basePos = this.getPlayerPosition();
        this.entityManager.spawnRandom(type, basePos);
    }

    getPlayerPosition() {
        if (this.driveController.active && this.driveController.targetMesh) {
            return this.driveController.targetMesh.position;
        }
        if (this.sceneManager.scene.activeCamera === this.sceneManager.fpCamera) {
            return this.sceneManager.fpCamera.position;
        }
        // Fallback to orbit camera target (where user is looking)
        return this.sceneManager.camera.target;
    }
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

            // Update Dashboard visuals if data changed
            if (newMeta.dashboard && mesh.metadata.behavior.type === "dashboard") {
                this.dashboardManager.buildDashboardVisuals(mesh);
            }
        }
    }
    setAIEnabled(enabled) {
        this.aiManager.setEnabled(enabled);
        this.spawnerManager.setEnabled(enabled);
        this.combatManager.setEnabled(enabled);
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

        // If AI is enabled, clicking a mesh might mean an attack!
        if (this.aiManager.enabled && root.metadata && root.metadata.stats) {
            this.combatManager.applyDamage(root, 10); // Basic 10 dmg slap
        }

        const pos = root.position;
        let metaJson = "{}";
        try {
            metaJson = JSON.stringify(root.metadata || {});
        } catch (e) {
            console.warn("Circular reference in metadata detected, using safe fallback", e);
            const safeMeta = {};
            if (root.metadata) {
                for (const key in root.metadata) {
                    if (typeof root.metadata[key] !== 'object' || root.metadata[key] === null) {
                        safeMeta[key] = root.metadata[key];
                    }
                }
            }
            metaJson = JSON.stringify(safeMeta);
        }

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
