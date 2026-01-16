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

            // Initialize active tracking if not present
            if (!spawner._activeSpawns) spawner._activeSpawns = [];

            const frequencyMs = (meta.frequency || 10) * 1000;
            const max = meta.maxSpawned || 10;

            // If this is the first time we've seen this spawner, trigger an instant spawn if under cap
            if (spawner._lastSpawn === undefined) {
                console.log(`🎬 Initializing spawner: ${spawner.name}`);
                if (spawner._activeSpawns.length < max) {
                    this.spawn(spawner);
                }
                spawner._lastSpawn = now;
                return;
            }

            const elapsed = now - spawner._lastSpawn;

            if (elapsed >= frequencyMs) {
                spawner._lastSpawn = now;

                // Only spawn if under the cap
                if (spawner._activeSpawns.length < max) {
                    this.spawn(spawner);
                } else {
                    // Silently log cap reached to avoid spam, or only once
                    if (!spawner._capLogged) {
                        console.log(`⏳ Spawner ${spawner.name} at max capacity (${max})`);
                        spawner._capLogged = true;
                    }
                }
            } else {
                spawner._capLogged = false; // Reset log flag when cooldown is active
            }
        });
    }

    async spawn(spawner) {
        const meta = spawner.metadata.spawner;
        console.log(`🌀 Spawner ${spawner.name} is spawning ${meta.spawnType}...`);

        // Spawn at spawner position with a small offset
        const pos = spawner.position.clone();
        pos.x += (Math.random() - 0.5) * 3;
        pos.z += (Math.random() - 0.5) * 3;
        pos.y += 1.0;

        const mob = await this.entityManager.spawnRecipe(meta.spawnType, pos);
        if (mob) {
            // Track this mob
            spawner._activeSpawns.push(mob.id);

            // Auto-cleanup when mob is destroyed
            mob.onDisposeObservable.add(() => {
                spawner._activeSpawns = spawner._activeSpawns.filter(id => id !== mob.id);
                console.log(`📉 Entity ${mob.id} removed from spawner ${spawner.name} tracking.`);
            });
        }
    }
}
