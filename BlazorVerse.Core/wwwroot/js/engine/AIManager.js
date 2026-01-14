export class AIManager {
    constructor() {
        this.scene = null;
        this.mobs = [];
        this.playerMesh = null;
        this.playerHp = 100;
        this.lastUpdateTime = 0;
        this.dotNetRef = null;
        this.enabled = false; // Default to false, let Runner/Editor enable it
    }

    init(scene, dotNetRef) {
        this.scene = scene;
        this.dotNetRef = dotNetRef;
        console.log("AIManager Initialized 🧠");
    }

    setPlayer(playerMesh) {
        this.playerMesh = playerMesh;
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        console.log(`AIManager set to: ${enabled ? "ACTIVE" : "PAUSED"}`);

        if (!enabled) {
            // Stop all mobs immediately and make them static so they don't drift in Editor
            this.mobs.forEach(mob => {
                const body = mob.physicsBody || (mob.physicsAggregate ? mob.physicsAggregate.body : null);
                if (body) {
                    body.setLinearVelocity(BABYLON.Vector3.Zero());
                    body.setAngularVelocity(BABYLON.Vector3.Zero());
                    body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
                }
            });
        } else {
            // Wake them up and make them dynamic for the game/simulation
            this.mobs.forEach(mob => {
                const body = mob.physicsBody || (mob.physicsAggregate ? mob.physicsAggregate.body : null);
                if (body) {
                    body.setMotionType(BABYLON.PhysicsMotionType.DYNAMIC);
                }
            });
        }
    }

    update() {
        if (!this.scene) return;

        const now = Date.now();
        const delta = now - this.lastUpdateTime;
        this.lastUpdateTime = now;

        // Sync list of mobs in the scene
        this.mobs = this.scene.meshes.filter(m => m.metadata && m.metadata.type === "recipe");

        if (!this.enabled) {
            // Ensure all mobs are static when AI is paused (Editor mode)
            this.mobs.forEach(mob => {
                const body = mob.physicsBody || (mob.physicsAggregate ? mob.physicsAggregate.body : null);
                if (body && body.getMotionType() !== BABYLON.PhysicsMotionType.STATIC) {
                    body.setMotionType(BABYLON.PhysicsMotionType.STATIC);
                }
            });
            return;
        }

        this.mobs.forEach(mob => {
            if (!mob.metadata.stats || mob.metadata.stats.hp <= 0) return;

            const behavior = mob.metadata.behavior;
            const stats = mob.metadata.stats;
            const body = mob.physicsBody || (mob.physicsAggregate ? mob.physicsAggregate.body : null);
            if (!body) return;

            const dist = this.playerMesh ? BABYLON.Vector3.Distance(mob.position, this.playerMesh.position) : 999;

            // Simple State Machine
            if (behavior.type === "hostile" && dist < behavior.aggroRange) {
                this.chasePlayer(mob, body, stats, dist, delta);
            } else {
                this.roam(mob, body, stats, behavior);
            }
        });
    }

    chasePlayer(mob, body, stats, dist, delta) {
        if (!this.playerMesh) return;

        const behavior = mob.metadata.behavior;

        // If close enough, attack
        if (dist < 2.5) {
            this.mobAttack(mob, stats, behavior, delta);
        }

        // Calculate direction to player
        const dir = this.playerMesh.position.subtract(mob.position);
        dir.y = 0; // Keep on ground
        dir.normalize();

        // Rotate to face player
        const targetRotation = Math.atan2(dir.x, dir.z);
        mob.rotation.y = BABYLON.Scalar.LerpAngle(mob.rotation.y, targetRotation, 0.1);

        // Move forward using velocity for more consistent character movement
        const currentVel = body.getLinearVelocity();
        const targetVel = dir.scale(stats.speed * 120);
        currentVel.x = targetVel.x;
        currentVel.z = targetVel.z;
        body.setLinearVelocity(currentVel);
    }

    mobAttack(mob, stats, behavior, delta) {
        if (!mob._lastAtk) mob._lastAtk = 0;
        mob._lastAtk += delta;

        if (mob._lastAtk >= (behavior.attackCooldown || 1000)) {
            mob._lastAtk = 0;
            console.log(`💥 Mob attacks player for ${stats.atk} damage!`);
            this.playerHp -= stats.atk;
            if (this.dotNetRef) {
                this.dotNetRef.invokeMethodAsync("UpdatePlayerHealth", this.playerHp);
            }
        }
    }

    playerAttack() {
        if (!this.playerMesh) return;
        console.log("⚔️ Player attacks!");

        // Simple proximity attack
        this.mobs.forEach(mob => {
            const dist = BABYLON.Vector3.Distance(this.playerMesh.position, mob.position);
            if (dist < 3.5) {
                this.takeDamage(mob, 10); // Hardcoded player damage for now
            }
        });
    }

    takeDamage(mob, amount) {
        if (!mob.metadata.stats) return;
        mob.metadata.stats.hp -= amount;
        console.log(`🎯 Mob ${mob.name} takes ${amount} damage! HP: ${mob.metadata.stats.hp}`);

        if (mob.metadata.stats.hp <= 0) {
            this.killMob(mob);
        } else {
            // Visual feedback
            const mesh = mob;
            const originalColor = mesh.getChildMeshes()[0].material.diffuseColor.clone();
            mesh.getChildMeshes().forEach(c => c.material.diffuseColor = new BABYLON.Color3(1, 0, 0));
            setTimeout(() => {
                mesh.getChildMeshes().forEach(c => c.material.diffuseColor = originalColor);
            }, 100);
        }
    }

    killMob(mob) {
        console.log(`💀 Mob ${mob.name} killed!`);
        // Simple scale down and dispose
        mob.scaling.set(0.1, 0.1, 0.1);
        setTimeout(() => mob.dispose(), 100);
    }

    roam(mob, body, stats, behavior) {
        // Simple random wandering
        if (!mob._roamDir || Math.random() < 0.02) {
            const angle = Math.random() * Math.PI * 2;
            mob._roamDir = new BABYLON.Vector3(Math.sin(angle), 0, Math.cos(angle));
            mob._targetRot = angle;
        }

        // Rotate to roam direction
        mob.rotation.y = BABYLON.Scalar.LerpAngle(mob.rotation.y, mob._targetRot, 0.05);

        // Move forward slowly using velocity
        const currentVel = body.getLinearVelocity();
        const targetVel = mob._roamDir.scale(stats.speed * 60);
        currentVel.x = targetVel.x;
        currentVel.z = targetVel.z;
        body.setLinearVelocity(currentVel);

        // Visual "Bobbing" using a small vertical impulse periodically
        if (Math.random() < 0.05) {
            body.applyImpulse(new BABYLON.Vector3(0, 0.5, 0), mob.getAbsolutePosition());
        }
    }
}
