export class Serializer {
    constructor() {
        this.sceneManager = null;
        this.entityManager = null;
    }

    init(sceneManager, entityManager) {
        this.sceneManager = sceneManager;
        this.entityManager = entityManager;
        console.log("Serializer Initialized 💾");
    }

    export() {
        const scene = this.sceneManager.scene;
        if (!scene) return "{}";

        const env = {
            clearColor: { r: scene.clearColor.r, g: scene.clearColor.g, b: scene.clearColor.b },
            fogDensity: scene.fogDensity,
            groundTexture: scene.getMeshByName("ground").material.diffuseTexture.name.split('/').pop()
        };

        const entities = [];
        scene.meshes.forEach(m => {
            if (m.name.includes("_") && !m.parent) {
                const type = m.metadata ? m.metadata.type : m.name.split('_')[0];
                const entity = {
                    type: type,
                    name: m.name,
                    pos: { x: m.position.x, y: m.position.y, z: m.position.z },
                    rot: { x: m.rotation.x, y: m.rotation.y, z: m.rotation.z },
                    color: m.material && m.material.diffuseColor ? { r: m.material.diffuseColor.r, g: m.material.diffuseColor.g, b: m.material.diffuseColor.b } : null
                };

                if (type === "recipe" && m.metadata.recipeId) {
                    entity.recipeId = m.metadata.recipeId;
                }

                entities.push(entity);
            }
        });

        return JSON.stringify({ version: "1.0", env: env, entities: entities });
    }

    async load(jsonStr) {
        const data = JSON.parse(jsonStr);
        if (!data) return;

        // 1. Clear existing entities
        this.sceneManager.scene.meshes.slice().forEach(m => {
            if (m.name.includes("_") && !m.parent) m.dispose();
        });

        // 2. Restore Environment
        const e = data.env;
        if (e) {
            this.sceneManager.setAtmosphere(e.clearColor.r, e.clearColor.g, e.clearColor.b, e.fogDensity);
            this.sceneManager.setGroundTexture(e.groundTexture);
        }

        // 3. Restore Entities
        if (data.entities) {
            for (const ent of data.entities) {
                if (ent.type === "recipe" && ent.recipeId) {
                    await this.entityManager.spawnRecipe(ent.recipeId, ent.pos, ent.rot, ent.name);
                } else {
                    this.entityManager.createEntity(ent.type, ent.pos, ent.rot, ent.color, ent.name);
                }
            }
        }
        console.log("Scene Loaded Successfully 📖");
    }
}
