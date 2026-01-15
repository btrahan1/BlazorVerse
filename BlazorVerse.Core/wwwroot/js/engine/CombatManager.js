export class CombatManager {
    constructor() {
        this.scene = null;
        this.guiTexture = null;
        this.healthBars = new Map();
        this.enabled = true;
    }

    init(scene) {
        this.scene = scene;
        // Create a fullscreen UI for floating bars
        this.guiTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, this.scene);
    }

    /**
     * Attaches a health bar to a mesh if it has stats in metadata
     */
    addHealthBar(mesh) {
        if (!mesh || !mesh.metadata || !mesh.metadata.stats || !mesh.metadata.stats.hp) return;
        if (this.healthBars.has(mesh.id)) return;

        const container = new BABYLON.GUI.Rectangle("hpContainer");
        container.width = "42px";
        container.height = "12px";
        container.cornerRadius = 2;
        container.thickness = 1;
        container.background = "black";
        this.guiTexture.addControl(container);
        container.linkWithMesh(mesh);
        container.linkOffsetY = -50;

        const background = new BABYLON.GUI.Rectangle("hpBg");
        background.width = "40px";
        background.height = "10px";
        background.background = "red";
        background.thickness = 0;
        container.addControl(background);

        const foreground = new BABYLON.GUI.Rectangle("hpFg");
        foreground.width = "40px";
        foreground.height = "10px";
        foreground.background = "green";
        foreground.thickness = 0;
        foreground.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        container.addControl(foreground);

        this.healthBars.set(mesh.id, { container, foreground, maxWidth: 40 });

        console.log(`+ Attached Health Bar to ${mesh.name}`);
    }

    update() {
        if (!this.enabled) return;

        // Cleanup health bars for disposed meshes
        for (const [id, data] of this.healthBars.entries()) {
            const mesh = this.scene.getMeshByID(id);
            if (!mesh) {
                data.container.dispose();
                this.healthBars.delete(id);
                continue;
            }

            // Update bar width based on HP
            const stats = mesh.metadata.stats;
            const pct = Math.max(0, stats.hp / stats.maxHp);
            data.foreground.width = `${pct * data.maxWidth}px`;
        }
    }

    applyDamage(target, amount) {
        if (!target || !target.metadata || !target.metadata.stats) return;

        const stats = target.metadata.stats;
        stats.hp -= amount;
        console.log(`💥 ${target.name} took ${amount} damage! (HP: ${stats.hp}/${stats.maxHp})`);

        // Damage Popup
        this.showDamagePopup(target, amount);

        // Visual Hit Flash
        const children = target.getChildMeshes();
        if (children.length > 0) {
            children.forEach(c => {
                if (c.material && c.material.diffuseColor) {
                    const original = c.material.diffuseColor.clone();
                    c.material.diffuseColor = new BABYLON.Color3(1, 0, 0); // Flash RED
                    setTimeout(() => {
                        if (c && c.material) c.material.diffuseColor = original;
                    }, 100);
                }
            });
        }

        if (stats.hp <= 0) {
            this.handleDeath(target);
        }
    }

    showDamagePopup(mesh, amount) {
        const text = new BABYLON.GUI.TextBlock();
        text.text = `-${Math.floor(amount)}`;
        text.color = "yellow";
        text.fontSize = 24;
        text.fontWeight = "bold";
        text.outlineColor = "black";
        text.outlineWidth = 2;

        this.guiTexture.addControl(text);
        text.linkWithMesh(mesh);
        text.linkOffsetY = -100;

        // Animate upwards and fade out
        let floatY = -100;
        let alpha = 1.0;
        const anim = () => {
            floatY -= 2;
            alpha -= 0.02;
            text.linkOffsetY = floatY;
            text.alpha = alpha;

            if (alpha <= 0) {
                this.scene.onBeforeRenderObservable.removeCallback(anim);
                text.dispose();
            }
        };
        this.scene.onBeforeRenderObservable.add(anim);
    }

    handleDeath(entity) {
        console.log(`💀 ${entity.name} DIED!`);

        // Remove from health bars
        if (this.healthBars.has(entity.id)) {
            this.healthBars.get(entity.id).container.dispose();
            this.healthBars.delete(entity.id);
        }

        // Death effect: scale down then dispose
        entity.scaling.set(0.1, 0.1, 0.1);
        setTimeout(() => {
            if (!entity.isDisposed()) entity.dispose();
        }, 150);
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        // Toggle visibility of health bars
        for (const data of this.healthBars.values()) {
            data.container.isVisible = enabled;
        }
    }
}
