export class EntityManager {
    constructor() {
        this.scene = null;
        this.shadowGen = null;
    }

    init(scene, shadowGen) {
        this.scene = scene;
        this.shadowGen = shadowGen;
        console.log("EntityManager Initialized 📦");
    }

    spawnRandom(type) {
        const x = (Math.random() - 0.5) * 10;
        const z = (Math.random() - 0.5) * 10;

        let y = 1.0;
        if (type === "car") y = 0.6;
        if (type === "walker") y = 1.25;

        this.createEntity(type, { x, y, z }, null, null, null);
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
            mesh.metadata = { type: "car" }; // Ensure type is preserved for serialization
        } else if (type === "walker") {
            mesh = BABYLON.MeshBuilder.CreateBox(name || "walker_" + Date.now(), { width: 1, height: 1.5, depth: 0.5 }, scene);
            const head = BABYLON.MeshBuilder.CreateSphere("head", { diameter: 0.7 }, scene);
            head.parent = mesh; head.position.y = 1;
            const leftLeg = BABYLON.MeshBuilder.CreateBox("leftLeg", { width: 0.3, height: 1, depth: 0.3 }, scene);
            leftLeg.parent = mesh; leftLeg.position.set(-0.3, -1.25, 0); leftLeg.setPivotPoint(new BABYLON.Vector3(0, 0.5, 0));
            const rightLeg = BABYLON.MeshBuilder.CreateBox("rightLeg", { width: 0.3, height: 1, depth: 0.3 }, scene);
            rightLeg.parent = mesh; rightLeg.position.set(0.3, -1.25, 0); rightLeg.setPivotPoint(new BABYLON.Vector3(0, 0.5, 0));
            mesh.metadata = { type: "walker", legs: [leftLeg, rightLeg] };
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
                mesh.physicsAggregate = new BABYLON.PhysicsAggregate(mesh, shapeType, { mass: isStatic ? 0 : 1, friction: 0.5, restitution: 0.3 }, scene);
            }

            if (shape) {
                mesh.physicsBody = new BABYLON.PhysicsBody(mesh, BABYLON.PhysicsMotionType.DYNAMIC, false, scene);
                mesh.physicsBody.shape = shape;
                mesh.physicsBody.setMassProperties({ mass: 1 });
            }

            mesh.addBehavior(new BABYLON.PointerDragBehavior({ dragPlaneNormal: new BABYLON.Vector3(0, 1, 0) }));

            if (this.shadowGen) {
                this.shadowGen.getShadowMap().renderList.push(mesh);
                mesh.getChildMeshes().forEach(c => this.shadowGen.getShadowMap().renderList.push(c));
            }
        }
        return mesh;
    }

    animate() {
        const time = Date.now() * 0.01; // Faster swing
        this.scene.meshes.forEach(m => {
            if (m.metadata && m.metadata.type === "walker") {
                const legs = m.metadata.legs;
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
