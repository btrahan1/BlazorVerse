export class DriveController {
    constructor() {
        this.active = false;
        this.targetMesh = null;
        this.scene = null;
        this.mainCamera = null;
        this.cameraBeforeDrive = null;
        this.followCam = null;
        this.canvas = null;
        this.inputMap = {};
        this.power = 5.0; // Default reduced speed

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleWheel = this.handleWheel.bind(this);
    }

    setPower(value) {
        this.power = value;
        console.log("Drive Power set to:", value);
    }

    init(scene, mainCamera, canvas) {
        this.scene = scene;
        this.mainCamera = mainCamera;
        this.canvas = canvas;
        console.log("DriveController Initialized 🏎️");
    }

    enter(mesh) {
        if (!mesh) return;
        this.active = true;
        this.targetMesh = mesh;
        this.inputMap = {};
        this.cameraBeforeDrive = this.scene.activeCamera;

        this.scene.activeCamera.detachControl();

        if (this.followCam) this.followCam.dispose();

        // Use ArcRotateCamera for free look-around
        const cam = new BABYLON.ArcRotateCamera("driveCam", -Math.PI / 2, Math.PI / 3, 10, mesh.position, this.scene);
        cam.lowerRadiusLimit = 5;
        cam.upperRadiusLimit = 50;
        cam.attachControl(this.canvas, true);

        this.followCam = cam;
        this.scene.activeCamera = this.followCam;

        window.addEventListener("keydown", this.handleKeyDown);
        window.addEventListener("keyup", this.handleKeyUp);
        window.addEventListener("wheel", this.handleWheel);
        console.log("Entering Drive Mode 🏁");
    }

    exit() {
        if (!this.active) return;
        this.active = false;
        this.targetMesh = null;

        const restoreCam = this.cameraBeforeDrive || this.mainCamera;
        this.scene.activeCamera = restoreCam;
        restoreCam.attachControl(this.canvas, true);

        if (this.followCam) this.followCam.dispose();

        window.removeEventListener("keydown", this.handleKeyDown);
        window.removeEventListener("keyup", this.handleKeyUp);
        window.removeEventListener("wheel", this.handleWheel);
        console.log("Exiting Drive Mode");
    }

    handleKeyDown(evt) {
        this.inputMap[evt.key.toLowerCase()] = true;
        if (evt.key === "Escape") this.exit();
    }

    handleKeyUp(evt) {
        this.inputMap[evt.key.toLowerCase()] = false;
    }

    handleWheel(evt) {
        // ArcRotateCamera handles zoom natively when attached to canvas
    }

    update() {
        if (!this.active || !this.targetMesh) return;

        const mesh = this.targetMesh;
        const body = mesh.physicsBody || (mesh.physicsAggregate ? mesh.physicsAggregate.body : null);

        if (!body) return;

        const isWalker = mesh.metadata && mesh.metadata.type === "walker";
        const force = this.power * 0.25;
        const turnForce = isWalker ? 4.0 : 2.0; // Walkers turn twice as fast

        if (isWalker) {
            const velocity = body.getLinearVelocity();
            let newVel = new BABYLON.Vector3(0, velocity.y, 0); // Preserve gravity

            if (this.inputMap["w"]) {
                const forward = mesh.getDirection(BABYLON.Axis.Z);
                newVel.addInPlace(forward.scale(this.power));
            }
            if (this.inputMap["s"]) {
                const forward = mesh.getDirection(BABYLON.Axis.Z);
                newVel.addInPlace(forward.scale(-this.power));
            }

            body.setLinearVelocity(newVel);

            if (this.inputMap["a"]) {
                body.setAngularVelocity(new BABYLON.Vector3(0, -turnForce, 0));
            } else if (this.inputMap["d"]) {
                body.setAngularVelocity(new BABYLON.Vector3(0, turnForce, 0));
            } else {
                body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
            }
        } else {
            // Traditional vehicle (Car) physics using impulses
            if (this.inputMap["w"]) {
                const forward = mesh.getDirection(BABYLON.Axis.Z);
                body.applyImpulse(forward.scale(force), mesh.getAbsolutePosition());
            }
            if (this.inputMap["s"]) {
                const forward = mesh.getDirection(BABYLON.Axis.Z);
                body.applyImpulse(forward.scale(-force), mesh.getAbsolutePosition());
            }

            if (this.inputMap["a"]) {
                body.setAngularVelocity(new BABYLON.Vector3(0, -turnForce, 0));
            } else if (this.inputMap["d"]) {
                body.setAngularVelocity(new BABYLON.Vector3(0, turnForce, 0));
            } else {
                body.setAngularVelocity(new BABYLON.Vector3(0, 0, 0));
            }
        }

        // --- LATERAL TRACTION (GRIP) ---
        // Cars need grip to turn, but Walkers should move more directly
        if (!isWalker) {
            const velocity = body.getLinearVelocity();
            const right = mesh.getDirection(BABYLON.Axis.X);
            const lateralVelocity = right.scale(BABYLON.Vector3.Dot(velocity, right));

            // Counter-act lateral movement by 80% per frame to simulate "grip"
            const frictionForce = lateralVelocity.scale(-0.8);
            body.applyImpulse(frictionForce, mesh.getAbsolutePosition());
        }
    }

    dispose() {
        this.exit();
    }
}
