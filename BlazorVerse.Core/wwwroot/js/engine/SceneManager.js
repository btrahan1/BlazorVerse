export class SceneManager {
    constructor() {
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.fpCamera = null;
        this.mainLight = null;
        this.shadowGen = null;
        this.environmentRoot = null;
        this.physicsPlugin = null;
    }

    async init(canvas, onSelectCallback) {
        this.engine = new BABYLON.Engine(canvas, true);
        this.scene = new BABYLON.Scene(this.engine);

        // --- PHYSICS INIT ---
        const havokInstance = await HavokPhysics();
        this.physicsPlugin = new BABYLON.HavokPlugin(true, havokInstance);
        this.scene.enablePhysics(new BABYLON.Vector3(0, -9.81, 0), this.physicsPlugin);

        this.setupCamera(canvas);
        this.setupLights();
        this.setupEnvironment();
        this.setupBoundaries();

        // Enable Gravity for the scene
        this.scene.collisionsEnabled = true;
        this.scene.gravity = new BABYLON.Vector3(0, -0.15, 0);

        // Selection Logic
        this.scene.onPointerDown = (evt, pickResult) => {
            if (pickResult.hit && pickResult.pickedMesh &&
                pickResult.pickedMesh.name !== "skyBox" &&
                pickResult.pickedMesh.name !== "ground" &&
                onSelectCallback) {
                onSelectCallback(pickResult.pickedMesh);
            }
        };

        window.addEventListener("resize", this.handleResize.bind(this));
        console.log("SceneManager Initialized 🌎");
    }

    handleResize() {
        if (this.engine) this.engine.resize();
    }

    setupCamera(canvas) {
        // 1. Orbit Camera (Existing)
        this.camera = new BABYLON.ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2.5, 15, BABYLON.Vector3.Zero(), this.scene);
        this.camera.attachControl(canvas, true);

        // 2. First Person Walking Camera
        this.fpCamera = new BABYLON.UniversalCamera("fpCamera", new BABYLON.Vector3(0, 2, 0), this.scene);
        this.fpCamera.setTarget(BABYLON.Vector3.Zero());

        // FP Camera Configuration for Walking
        this.fpCamera.speed = 0.5;
        this.fpCamera.angularSensibility = 1000;

        // Collision logic for the camera
        this.fpCamera.checkCollisions = true;
        this.fpCamera.applyGravity = true;
        this.fpCamera.ellipsoid = new BABYLON.Vector3(0.5, 1, 0.5); // Player size
        this.fpCamera.ellipsoidOffset = new BABYLON.Vector3(0, 1, 0);

        // Map WASD keys for fpCamera
        this.fpCamera.keysUp.push(87);    // W
        this.fpCamera.keysDown.push(83);  // S
        this.fpCamera.keysLeft.push(65);  // A
        this.fpCamera.keysRight.push(68); // D
    }

    setEditorCameraMode(mode, canvas) {
        // mode: 'orbit' or 'walk'
        if (mode === 'walk') {
            // Position fpCamera at current orbit camera's XZ, but at head height
            const pos = this.camera.position.clone();
            pos.y = 2;
            this.fpCamera.position = pos;

            // Look at whatever the orbit camera was looking at (adjust height to horizon)
            const target = this.camera.target.clone();
            target.y = 2;
            this.fpCamera.setTarget(target);

            this.camera.detachControl();
            this.scene.activeCamera = this.fpCamera;
            this.fpCamera.attachControl(canvas, true);

            // Add FOV Zoom Support
            this._walkWheelHandler = (evt) => {
                if (this.scene.activeCamera !== this.fpCamera) return;
                const zoomSpeed = 0.0005;
                this.fpCamera.fov += evt.deltaY * zoomSpeed;
                // Clamp FOV between ~5 and 85 degrees in radians
                this.fpCamera.fov = Math.max(0.1, Math.min(1.5, this.fpCamera.fov));
            };
            window.addEventListener("wheel", this._walkWheelHandler);

            console.log("Switched to Walk Mode 🚶 (Positioned & Zoom Enabled)");
        } else {
            if (this._walkWheelHandler) {
                window.removeEventListener("wheel", this._walkWheelHandler);
            }
            this.fpCamera.detachControl();
            this.scene.activeCamera = this.camera;
            this.camera.attachControl(canvas, true);
            console.log("Switched to Orbit Mode 🦅");
        }
    }

    setupLights() {
        this.mainLight = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(1, 1, 0), this.scene);
        this.mainLight.intensity = 0.3;

        const sun = new BABYLON.DirectionalLight("sun", new BABYLON.Vector3(-1, -2, -1), this.scene);
        sun.position = new BABYLON.Vector3(20, 40, 20);
        sun.intensity = 1.0;

        this.shadowGen = new BABYLON.ShadowGenerator(1024, sun);
        this.shadowGen.useBlurExponentialShadowMap = true;
        this.shadowGen.blurKernel = 32;
    }

    setupEnvironment() {
        this.environmentRoot = new BABYLON.TransformNode("envRoot", this.scene);

        // Default Atmosphere: Mad Max Orange
        this.scene.clearColor = new BABYLON.Color4(0.8, 0.5, 0.2, 1);
        this.scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        this.scene.fogDensity = 0.005;
        this.scene.fogColor = new BABYLON.Color3(0.7, 0.5, 0.3);

        const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 1000.0 }, this.scene);
        const skyboxMaterial = new BABYLON.StandardMaterial("skyBox", this.scene);
        skyboxMaterial.backFaceCulling = false;
        skyboxMaterial.diffuseColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        skyboxMaterial.emissiveColor = new BABYLON.Color3(0.8, 0.5, 0.2);
        skybox.material = skyboxMaterial;
        skybox.parent = this.environmentRoot;

        const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 1000, height: 1000, subdivisions: 2 }, this.scene);
        const groundMat = new BABYLON.StandardMaterial("sandMat", this.scene);
        groundMat.diffuseTexture = new BABYLON.Texture("textures/sand.jpg", this.scene);
        groundMat.diffuseTexture.uScale = 50;
        groundMat.diffuseTexture.vScale = 50;
        ground.material = groundMat;
        ground.receiveShadows = true;
        ground.checkCollisions = true; // Enable collision for UniversalCamera
        ground.parent = this.environmentRoot;

        // Ground Physics (Static)
        new BABYLON.PhysicsAggregate(ground, BABYLON.PhysicsShapeType.BOX, {
            mass: 0,
            friction: 0.5,
            membership: 1, // CAT_STATIC
            mask: 0xFF     // CAT_ALL
        }, this.scene);
    }

    setupBoundaries() {
        const size = 1000;
        const halfSize = size / 2;
        const thickness = 2;
        const height = 50;

        const walls = [
            { name: "north", pos: new BABYLON.Vector3(0, height / 2, halfSize), scale: new BABYLON.Vector3(size, height, thickness) },
            { name: "south", pos: new BABYLON.Vector3(0, height / 2, -halfSize), scale: new BABYLON.Vector3(size, height, thickness) },
            { name: "east", pos: new BABYLON.Vector3(halfSize, height / 2, 0), scale: new BABYLON.Vector3(thickness, height, size) },
            { name: "west", pos: new BABYLON.Vector3(-halfSize, height / 2, 0), scale: new BABYLON.Vector3(thickness, height, size) }
        ];

        const brickMat = new BABYLON.StandardMaterial("brickMat", this.scene);
        brickMat.diffuseColor = new BABYLON.Color3(0.6, 0.2, 0.1); // Burnt red
        brickMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);

        walls.forEach(w => {
            const wall = BABYLON.MeshBuilder.CreateBox(w.name + "_boundary", { width: w.scale.x, height: w.scale.y, depth: w.scale.z }, this.scene);
            wall.position = w.pos;
            wall.material = brickMat;
            wall.checkCollisions = true; // Enable collision for UniversalCamera
            wall.parent = this.environmentRoot;

            // Static physics
            new BABYLON.PhysicsAggregate(wall, BABYLON.PhysicsShapeType.BOX, { mass: 0, friction: 0.5 }, this.scene);
        });
        console.log("Boundary Walls Established (Brick Style) 🛡️🧱");
    }

    toggleFog(enabled) {
        this.scene.fogMode = enabled ? BABYLON.Scene.FOGMODE_EXP2 : BABYLON.Scene.FOGMODE_NONE;
    }

    setGroundTexture(filename) {
        const ground = this.scene.getMeshByName("ground");
        if (!ground || !ground.material) return;
        if (ground.material.diffuseTexture) ground.material.diffuseTexture.dispose();

        const newTex = new BABYLON.Texture("textures/" + filename, this.scene);
        newTex.uScale = 50; newTex.vScale = 50;
        ground.material.diffuseTexture = newTex;
    }

    setAtmosphere(r, g, b, fogDensity) {
        this.scene.clearColor = new BABYLON.Color4(r, g, b, 1);
        this.scene.fogDensity = fogDensity;
        this.scene.fogColor = new BABYLON.Color3(r * 0.9, g * 0.9, b * 0.9);

        const skybox = this.scene.getMeshByName("skyBox");
        if (skybox && skybox.material) {
            skybox.material.emissiveColor = new BABYLON.Color3(r, g, b);
        }
    }

    getStats() {
        const cam = this.scene.activeCamera ? this.scene.activeCamera.position : BABYLON.Vector3.Zero();
        return {
            fps: this.engine.getFps(),
            x: cam.x, y: cam.y, z: cam.z,
            meshCount: this.scene.meshes.length,
            camType: this.scene.activeCamera ? this.scene.activeCamera.getClassName() : "None",
            lights: this.scene.lights.map(l => l.getClassName()).join(", "),
            res: this.engine.getRenderWidth() + "x" + this.engine.getRenderHeight(),
            verts: this.scene.getTotalVertices()
        };
    }

    dispose() {
        window.removeEventListener("resize", this.handleResize);
        if (this.scene) this.scene.dispose();
        if (this.engine) this.engine.dispose();
    }
}
