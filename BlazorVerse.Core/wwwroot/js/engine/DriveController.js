export class DriveController {
    constructor() {
        this.active = false;
        this.targetMesh = null;
        this.scene = null;
        this.mainCamera = null;
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

        this.mainCamera.detachControl();

        if (this.followCam) this.followCam.dispose();
        this.followCam = new BABYLON.FollowCamera("followCam", mesh.position, this.scene);
        this.followCam.radius = 10;
        this.followCam.heightOffset = 4;
        this.followCam.rotationOffset = 180;
        this.followCam.cameraAcceleration = 0.05;
        this.followCam.maxCameraSpeed = 10;
        this.followCam.lockedTarget = mesh;
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

        this.scene.activeCamera = this.mainCamera;
        this.mainCamera.attachControl(this.canvas, true);
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
        if (!this.active || !this.followCam) return;
        const zoomSensitivity = 0.05;
        this.followCam.radius += evt.deltaY * zoomSensitivity;
        this.followCam.radius = Math.max(5, Math.min(100, this.followCam.radius));
        if (!this.targetBody) {
            this.targetBody = this.targetMesh.physicsBody || (this.targetMesh.physicsAggregate ? this.targetMesh.physicsAggregate.body : null);
        }
    }

    update() {
        if (!this.active || !this.targetMesh) return;

        const mesh = this.targetMesh;
        const body = mesh.physicsBody || (mesh.physicsAggregate ? mesh.physicsAggregate.body : null);

        if (!body) return;

        const isWalker = mesh.metadata && mesh.metadata.type === "walker";
        const force = this.power * 0.25;
        const turnForce = isWalker ? 4.0 : 2.0; // Walkers turn twice as fast

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
