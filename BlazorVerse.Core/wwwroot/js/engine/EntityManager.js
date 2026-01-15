export class EntityManager {
    constructor() {
        this.scene = null;
        this.shadowGen = null;
        this._spawnAngle = 0;

        // Collision Categories (Bitmasks)
        this.CAT_STATIC = 1;
        this.CAT_PLAYER = 2;
        this.CAT_MOB = 4;
        this.CAT_ALL = 0xFF;
    }

    init(scene, shadowGen, combatManager, dashboardManager) {
        this.scene = scene;
        this.shadowGen = shadowGen;
        this.combatManager = combatManager;
        this.dashboardManager = dashboardManager;
        console.log("EntityManager Initialized 📦");
    }

    spawnRandom(type, basePos = null) {
        const center = basePos || new BABYLON.Vector3(0, 0, 0);

        // Ring spawning: Start at 8 units away to clear the player, up to 15
        const distance = 8 + Math.random() * 7;

        // Increment angle each time to ensure multiple spawns are spread out
        this._spawnAngle += 0.8 + (Math.random() * 0.4);

        const x = center.x + Math.cos(this._spawnAngle) * distance;
        const z = center.z + Math.sin(this._spawnAngle) * distance;

        let y = center.y + 1.0;
        if (type === "car") y = center.y + 0.6;
        if (type === "walker") y = center.y + 1.25;

        if (type === "goblin" || type === "wolf" || type === "shop_basic" || type === "spawner_basic" || type === "data_grid" || type === "bar_graph") {
            this.spawnRecipe(type, { x, y, z });
            return;
        }

        this.createEntity(type, { x, y, z }, null, null, null);
    }

    async spawnRecipe(recipeId, pos) {
        const recipe = await this.loadRecipe(recipeId);
        if (recipe) {
            this.createFromRecipe(recipe, pos);
        }
    }

    async loadRecipe(recipeId) {
        try {
            // Try different paths depending on whether we are in Editor or Core context
            const paths = [
                `/_content/BlazorVerse.Core/data/monsters/${recipeId}.json`,
                `/data/monsters/${recipeId}.json`,
                `/_content/BlazorVerse.Core/data/buildings/${recipeId}.json`,
                `/data/buildings/${recipeId}.json`,
                `/_content/BlazorVerse.Core/data/recipes/${recipeId}.json`,
                `/data/recipes/${recipeId}.json`,
                `/_content/BlazorVerse.Core/data/dashboard/${recipeId}.json`,
                `/data/dashboard/${recipeId}.json`
            ];

            for (const path of paths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) return await response.json();
                } catch (e) { }
            }
            console.error(`Could not load recipe: ${recipeId}`);
            return null;
        } catch (err) {
            console.error("Error fetching recipe:", err);
            return null;
        }
    }

    deleteMesh(id) {
        const mesh = this.scene.getMeshByID(id);
        if (mesh) mesh.dispose();
    }

    changeColor(id) {
        const mesh = this.scene.getMeshByID(id);
        if (mesh && mesh.material) {
            mesh.material.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());
        }
    }

    resetPos(id) {
        const mesh = this.scene.getMeshByID(id);
        if (mesh) {
            const isVehicle = mesh.name.startsWith("car") || mesh.name.startsWith("walker");
            mesh.position.set(0, isVehicle ? 1.5 : 1, 0);
            const body = mesh.physicsBody || (mesh.physicsAggregate ? mesh.physicsAggregate.body : null);
            if (body) {
                body.setLinearVelocity(BABYLON.Vector3.Zero());
                body.setAngularVelocity(BABYLON.Vector3.Zero());
            }
        }
    }

    createEntity(type, pos, rot, color, name) {
        let mesh;
        const scene = this.scene;

        if (type === "box") {
            mesh = BABYLON.MeshBuilder.CreateBox(name || "box_" + Date.now(), { size: 1 }, scene);
        } else if (type === "sphere") {
            mesh = BABYLON.MeshBuilder.CreateSphere(name || "sphere_" + Date.now(), { diameter: 1 }, scene);
        } else if (type === "wall") {
            mesh = BABYLON.MeshBuilder.CreateBox(name || "wall_" + Date.now(), { width: 2, height: 2, depth: 0.1 }, scene);
        } else if (type === "car") {
            const body = BABYLON.MeshBuilder.CreateBox("body", { width: 2, height: 0.6, depth: 4.2 }, scene);
            body.position.y = 0.8;

            const bodyMat = new BABYLON.StandardMaterial("bodyMat", scene);
            bodyMat.diffuseColor = color ? new BABYLON.Color3(color.r, color.g, color.b) : new BABYLON.Color3(0.2, 0.5, 0.9);
            bodyMat.specularColor = new BABYLON.Color3(0.5, 0.5, 0.5);
            body.material = bodyMat;

            const tireMat = new BABYLON.StandardMaterial("tireMat", scene);
            tireMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
            const rimMat = new BABYLON.StandardMaterial("rimMat", scene);
            rimMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);

            const wheels = [];
            const createWheel = (name, x, z) => {
                const tire = BABYLON.MeshBuilder.CreateCylinder(name + "_tire", { diameter: 1.1, height: 0.5 }, scene);
                tire.material = tireMat;

                const rim = BABYLON.MeshBuilder.CreateCylinder(name + "_rim", { diameter: 0.7, height: 0.55 }, scene);
                rim.material = rimMat;
                rim.parent = tire;

                tire.rotation.z = Math.PI / 2;
                // Wheels are parented to body.
                // Wheel radius is 0.55. We want the bottom at y=0 world.
                // With body center at 1.0, wheel center should be at 0.55.
                // Local offset = 0.55 - 1.0 = -0.45
                tire.position.set(x, -0.45, z);
                wheels.push(tire);
                return tire;
            };

            createWheel("w1", -1.2, 1.4);
            createWheel("w2", 1.2, 1.4);
            createWheel("w3", -1.2, -1.4);
            createWheel("w4", 1.2, -1.4);

            mesh = body;
            wheels.forEach(w => w.parent = mesh);
            mesh.name = name || "car_" + Date.now();
            mesh.id = mesh.name;
            mesh.metadata = { type: "car", stats: { hp: 200, maxHp: 200 } }; // Cars are tougher
        } else if (type === "walker") {
            mesh = BABYLON.MeshBuilder.CreateBox(name || "walker_" + Date.now(), { width: 1, height: 1.5, depth: 0.5 }, scene);
            const head = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.7 }, scene);
            head.parent = mesh; head.position.y = 1;
            const leftLeg = BABYLON.MeshBuilder.CreateBox("leftLeg", { width: 0.3, height: 1, depth: 0.3 }, scene);
            leftLeg.parent = mesh; leftLeg.position.set(-0.3, -1.25, 0); leftLeg.setPivotPoint(new BABYLON.Vector3(0, 0.5, 0));
            const rightLeg = BABYLON.MeshBuilder.CreateBox("rightLeg", { width: 0.3, height: 1, depth: 0.3 }, scene);
            rightLeg.parent = mesh; rightLeg.position.set(0.3, -1.25, 0); rightLeg.setPivotPoint(new BABYLON.Vector3(0, 0.5, 0));
            mesh._legs = [leftLeg, rightLeg];
            mesh.metadata = { type: "walker", stats: { hp: 100, maxHp: 100 } };
            mesh.id = mesh.name;
        } else if (type === "finish") {
            mesh = BABYLON.MeshBuilder.CreateBox(name || "finish_" + Date.now(), { width: 8, height: 4, depth: 1 }, scene);
            pos.y = 2; // Default vertical lift
            const mat = new BABYLON.StandardMaterial("finishMat", scene);
            mat.diffuseColor = new BABYLON.Color3(0, 1, 0);
            mat.alpha = 0.3;
            mesh.material = mat;
            mesh.metadata = { type: "finish" };
            mesh.id = mesh.name;
        } else if (type === "recipe" && name) {
            // This case is used by Serializer to restore recipe-based mobs
            // We'll need to async load the recipe first, or have it passed in.
            // For now, assume recipes are handled by createFromRecipe.
        }

        if (mesh) {
            mesh.position.set(pos.x, pos.y, pos.z);
            if (rot) mesh.rotation.set(rot.x, rot.y, rot.z);

            const mat = new BABYLON.StandardMaterial("mat_" + Date.now(), scene);
            if (color) mat.diffuseColor = new BABYLON.Color3(color.r, color.g, color.b);
            else mat.diffuseColor = new BABYLON.Color3(Math.random(), Math.random(), Math.random());

            mesh.material = mat;
            if (type === "walker") mesh.getChildMeshes().forEach(c => c.material = mat);

            mesh.checkCollisions = true;

            // --- CUSTOM PHYSICS SHAPES FOR VEHICLES ---
            let shape;
            if (type === "car") {
                // Body height 0.6 (top +0.3, bottom -0.3)
                // Wheels at -0.45, radius 0.55 -> Bottom at -1.0
                // Total height: 0.3 - (-1.0) = 1.3
                // Center: (0.3 + -1.0) / 2 = -0.35
                shape = new BABYLON.PhysicsShapeBox(
                    new BABYLON.Vector3(0, -0.35, 0),
                    BABYLON.Quaternion.Identity(),
                    new BABYLON.Vector3(2.5, 1.3, 4.2),
                    scene
                );
            } else if (type === "walker") {
                // Body height 1.5 (top 0.75, bottom -0.75)
                // Head at +1, radius 0.35 -> Top at 1.35
                // Legs at -1.25, height 1.0 -> Bottom at -1.75
                // Total height: 1.35 - (-1.75) = 3.1
                // Center: (1.35 + -1.75) / 2 = -0.2
                shape = new BABYLON.PhysicsShapeBox(
                    new BABYLON.Vector3(0, -0.2, 0),
                    BABYLON.Quaternion.Identity(),
                    new BABYLON.Vector3(1.2, 3.1, 0.7),
                    scene
                );
            } else {
                let shapeType = BABYLON.PhysicsShapeType.BOX;
                if (type === "sphere") shapeType = BABYLON.PhysicsShapeType.SPHERE;
                const isStatic = (type === "wall");
                const isPlayer = (type === "car" || type === "walker");

                mesh.physicsAggregate = new BABYLON.PhysicsAggregate(mesh, shapeType, {
                    mass: isStatic ? 0 : 1,
                    friction: 0.5,
                    restitution: 0.3,
                    membership: isStatic ? this.CAT_STATIC : (isPlayer ? this.CAT_PLAYER : 0),
                    mask: this.CAT_ALL
                }, scene);

                // Removed manual property setting as it's now in constructor
            }

            if (shape) {
                mesh.physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
                mesh.physicsBody.shape = shape;
                // STABILITY: Lock rotation (inertia = 0) to prevent tipping over
                mesh.physicsBody.setMassProperties({
                    mass: 1,
                    inertia: new BABYLON.Vector3(0, 0, 0)
                });

                // Vehicles are Players
                mesh.physicsBody.shape.filterMembershipMask = this.CAT_PLAYER;
                mesh.physicsBody.shape.filterCollideMask = this.CAT_ALL;
            }

            mesh.addBehavior(new BABYLON.PointerDragBehavior({ dragPlaneNormal: new BABYLON.Vector3(0, 1, 0) }));

            if (this.shadowGen) {
                this.shadowGen.getShadowMap().renderList.push(mesh);
                mesh.getChildMeshes().forEach(c => this.shadowGen.getShadowMap().renderList.push(c));
            }

            // Auto-add health bar if stats exist
            if (this.combatManager) {
                this.combatManager.addHealthBar(mesh);
            }
        }
        return mesh;
    }

    createFromRecipe(recipe, pos, rot, id) {
        const scene = this.scene;
        const root = new BABYLON.Mesh(id || `${recipe.id}_${Date.now()}`, scene);
        root.position.set(pos.x, pos.y, pos.z);
        if (rot) root.rotation.set(rot.x, rot.y, rot.z);

        // Calculate total bounds to ensure physics has a shape
        let min = new BABYLON.Vector3(Infinity, Infinity, Infinity);
        let max = new BABYLON.Vector3(-Infinity, -Infinity, -Infinity);

        recipe.visuals.forEach(vis => {
            let part;
            const size = vis.size;
            const vpos = new BABYLON.Vector3(vis.pos[0], vis.pos[1], vis.pos[2]);

            if (vis.type === "box") {
                part = BABYLON.MeshBuilder.CreateBox(vis.name, {
                    width: size[0], height: size[1], depth: size[2]
                }, scene);

                // Update bounds logic
                const half = new BABYLON.Vector3(size[0] / 2, size[1] / 2, size[2] / 2);
                min = BABYLON.Vector3.Minimize(min, vpos.subtract(half));
                max = BABYLON.Vector3.Maximize(max, vpos.add(half));
            } else if (vis.type === "sphere") {
                part = BABYLON.MeshBuilder.CreateSphere(vis.name, { diameter: size[0] }, scene);

                const rad = size[0] / 2;
                const offset = new BABYLON.Vector3(rad, rad, rad);
                min = BABYLON.Vector3.Minimize(min, vpos.subtract(offset));
                max = BABYLON.Vector3.Maximize(max, vpos.add(offset));
            }

            if (part) {
                part.parent = root;
                part.position.copyFrom(vpos);
                const mat = new BABYLON.StandardMaterial(vis.name + "_mat", scene);
                mat.diffuseColor = new BABYLON.Color3(vis.color.r, vis.color.g, vis.color.b);
                part.material = mat;
            }
        });

        // Apply bounding info to the empty root so PhysicsAggregate works
        if (min.x !== Infinity) {
            root.setBoundingInfo(new BABYLON.BoundingInfo(min, max));
        }

        root.metadata = {
            type: "recipe",
            recipeId: recipe.id,
            stats: JSON.parse(JSON.stringify(recipe.stats || {})),
            behavior: JSON.parse(JSON.stringify(recipe.behavior || {}))
        };

        if (this.combatManager) {
            this.combatManager.addHealthBar(root);
        }

        // Initialize Spawner/Building/Other specific data
        root.metadata.ownerName = recipe.id; // Default name is the ID

        if (root.metadata.behavior.type === "spawner") {
            root.metadata.ownerName = "New Spawner";
            root.metadata.spawner = {
                spawnType: "goblin", // Default
                frequency: 10 // Seconds
            };
        }
        if (root.metadata.behavior.type === "building") {
            root.metadata.ownerName = "Ye Ole Shop";
            root.metadata.style = "Rustic"; // Default style
            root.metadata.inventoryId = "armor"; // Default inventory
            this.applyStyle(root, root.metadata.style);
        }
        if (root.metadata.behavior.type === "dashboard") {
            const dbConfig = root.metadata.behavior.dashboard || {};
            root.metadata.ownerName = dbConfig.type === "grid" ? "Sales Data Grid" : "Inventory Graph";
            root.metadata.dashboard = {
                dataFile: dbConfig.dataFile || "",
                type: dbConfig.type
            };
            if (this.dashboardManager) {
                this.dashboardManager.buildDashboardVisuals(root);
            }
        }
        root.id = root.name;

        // Physics for the root
        const isBuilding = recipe.behavior.type === "building" || recipe.behavior.type === "spawner";
        const aggregate = new BABYLON.PhysicsAggregate(root, BABYLON.PhysicsShapeType.BOX, {
            mass: isBuilding ? 0 : 1,
            friction: 0.5,
            membership: isBuilding ? this.CAT_STATIC : this.CAT_MOB,
            mask: isBuilding ? this.CAT_ALL : (this.CAT_PLAYER | this.CAT_STATIC)
        }, scene);
        root.physicsAggregate = aggregate;

        // Lock rotation (prevent tipping over / spinning erratically)
        if (aggregate.body) {
            aggregate.body.setMassProperties({
                inertia: new BABYLON.Vector3(0, 0, 0),
                centerOfMass: BABYLON.Vector3.Zero()
            });
        }

        if (this.shadowGen) {
            this.shadowGen.getShadowMap().renderList.push(root);
            root.getChildMeshes().forEach(c => this.shadowGen.getShadowMap().renderList.push(c));
        }

        return root;
    }

    applyStyle(mesh, style) {
        if (!mesh || !style) return;
        console.log(`🎨 Applying style: ${style} to ${mesh.name}`);

        const children = mesh.getChildMeshes();
        children.forEach(c => {
            if (!c.material) return;

            if (style === "Rustic") {
                c.material.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.1); // Brownish
            } else if (style === "Modern") {
                c.material.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.25); // Sleek Dark Gray
            } else if (style === "Classic") {
                c.material.diffuseColor = new BABYLON.Color3(0.8, 0.8, 0.7); // Stone/Creme
            }
        });
    }

    animate() {
        const time = Date.now() * 0.01; // Faster swing
        this.scene.meshes.forEach(m => {
            if (m.metadata && m.metadata.type === "walker") {
                const legs = m._legs;
                if (!legs || legs.length < 2) return;

                const body = m.physicsBody || (m.physicsAggregate ? m.physicsAggregate.body : null);
                const velocity = body ? body.getLinearVelocity().length() : 0;

                if (velocity > 0.5) {
                    // Active walking: Big swings
                    legs[0].rotation.x = Math.sin(time) * 0.8;
                    legs[1].rotation.x = Math.sin(time + Math.PI) * 0.8;
                } else if (velocity > 0.1) {
                    // Slow shuffle: Small swings
                    legs[0].rotation.x = Math.sin(time) * 0.3;
                    legs[1].rotation.x = Math.sin(time + Math.PI) * 0.3;
                } else {
                    // Idle: Neutral position
                    legs[0].rotation.x = BABYLON.Scalar.Lerp(legs[0].rotation.x, 0, 0.1);
                    legs[1].rotation.x = BABYLON.Scalar.Lerp(legs[1].rotation.x, 0, 0.1);
                }
            }
        });
    }
}
