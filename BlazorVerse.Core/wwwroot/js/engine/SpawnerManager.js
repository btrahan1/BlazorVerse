export class SpawnerManager {
    constructor() {
        this.scene = null;
        this.entityManager = null;
        this.spawners = [];
        this.enabled = true;
    }

    init(scene, entityManager) {
        this.scene = scene;
        this.entityManager = entityManager;
        console.log("SpawnerManager Initialized 🌀");
    }

    setEnabled(enabled) {
        this.enabled = enabled;
    }

    update() {
        if (!this.scene || !this.enabled) return;

        const now = Date.now();

        // Find all meshes that have spawner metadata
        this.spawners = this.scene.meshes.filter(m => m.metadata && m.metadata.spawner);

        this.spawners.forEach(spawner => {
            const meta = spawner.metadata.spawner;
            if (!meta.spawnType || !meta.frequency) return;

            if (!spawner._lastSpawn) spawner._lastSpawn = now;

            const elapsed = now - spawner._lastSpawn;
            const frequencyMs = (meta.frequency || 10) * 1000;

            if (elapsed >= frequencyMs) {
                spawner._lastSpawn = now;
                this.spawn(spawner);
            }
        });
    }

    spawn(spawner) {
        const meta = spawner.metadata.spawner;
        console.log(`🌀 Spawner ${spawner.name} is spawning ${meta.spawnType}...`);

        // Spawn at spawner position with a small offset
        const pos = spawner.position.clone();
        pos.x += (Math.random() - 0.5) * 2;
        pos.z += (Math.random() - 0.5) * 2;
        pos.y += 1.0; // Ensure spawn above ground

        this.entityManager.spawnRecipe(meta.spawnType, pos);
    }
}
