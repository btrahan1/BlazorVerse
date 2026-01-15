export class DashboardManager {
    constructor() {
        this.scene = null;
    }

    init(scene) {
        this.scene = scene;
        console.log("DashboardManager Initialized 📊");
    }

    async buildDashboardVisuals(entity) {
        const dbMeta = entity.metadata.dashboard;
        const type = dbMeta.type;
        const dataFile = dbMeta.dataFile;

        console.log(`🏗️ Building Dashboard Visuals: ${type} (Data: ${dataFile}) for ${entity.name}`);

        const data = await this.loadData(dataFile);

        // Clear existing children (except recipe parts)
        const children = entity.getChildMeshes();
        children.forEach(c => {
            if (c.name.includes("effect") || c.name.includes("bar_") || c.name.includes("label_") || c.name.includes("base")) {
                c.dispose();
            }
        });

        if (type === "grid") {
            this.createDataGrid(entity, data);
        } else if (type === "graph") {
            this.createBarGraph(entity, data);
        }
    }

    async loadData(dataFile) {
        if (!dataFile) return [];
        try {
            const path = `/_content/BlazorVerse.Core/data/dashboard/business_data/${dataFile}.json`;
            const response = await fetch(path);
            if (response.ok) return await response.json();
        } catch (e) {
            console.warn("Failed to load dashboard data:", e);
        }
        return [];
    }

    createDataGrid(root, data) {
        const scene = this.scene;

        // 1. Scrolling Grid Texture Layer (Background)
        const gridLayer = BABYLON.MeshBuilder.CreateBox("grid_effect", { width: 2.4, height: 1.7, depth: 0.21 }, scene);
        gridLayer.parent = root;
        gridLayer.isPickable = false;

        const mat = new BABYLON.StandardMaterial("hologrid", scene);
        mat.diffuseColor = new BABYLON.Color3(0, 0.2, 0.1);
        mat.emissiveColor = new BABYLON.Color3(0, 0.5, 0.2);
        mat.alpha = 0.4;
        gridLayer.material = mat;

        // 2. Render actual rows
        const rowsToShow = data.slice(0, 5);
        rowsToShow.forEach((row, i) => {
            const label = BABYLON.MeshBuilder.CreatePlane("label_" + i, { width: 2.2, height: 0.25 }, scene);
            label.parent = root;
            label.position.set(0, 0.6 - (i * 0.35), -0.12);
            label.isPickable = false;

            const tex = new BABYLON.DynamicTexture("cellTex_" + i, { width: 512, height: 64 }, scene);
            const context = tex.getContext();
            context.fillStyle = "#00ff88";
            context.font = "bold 32px monospace";

            const text = `${row["Unit ID"]} | ${row["Unit Name"]} [${row["Quantity"]}]`;
            context.fillText(text, 10, 45);
            tex.update();

            const lMat = new BABYLON.StandardMaterial("labelMat_" + i, scene);
            lMat.diffuseTexture = tex;
            lMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
            lMat.useAlphaFromDiffusetexture = true;
            lMat.alpha = 0.9;
            label.material = lMat;
        });
    }

    createBarGraph(root, data) {
        const scene = this.scene;
        const rows = data.slice(0, 6);
        const barCount = rows.length || 5;
        const spacing = 0.4;
        const startX = -((barCount - 1) * spacing) / 2;

        rows.forEach((row, i) => {
            // Scale height based on Quantity (assuming max is around 25 for visual balance)
            const qty = row["Quantity"] || 10;
            const height = (qty / 10) + 0.5;

            const bar = BABYLON.MeshBuilder.CreateBox("bar_" + i, { width: 0.3, height: height, depth: 0.3 }, scene);
            bar.parent = root;
            bar.position.set(startX + (i * spacing), height / 2 + 0.1, 0);

            const mat = new BABYLON.StandardMaterial("barMat_" + i, scene);
            const hue = i / barCount;
            mat.emissiveColor = BABYLON.Color3.FromHSV(hue * 360, 0.8, 1);
            mat.alpha = 0.7;
            bar.material = mat;

            // Optional: Floating text for the value
            const p = BABYLON.MeshBuilder.CreatePlane("label_" + i, { width: 0.5, height: 0.2 }, scene);
            p.parent = bar;
            p.position.y = height / 2 + 0.2;
            p.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

            const tex = new BABYLON.DynamicTexture("qtyTex_" + i, { width: 128, height: 64 }, scene);
            tex.drawText(qty.toString(), null, null, "bold 40px Arial", "#ffffff", "transparent", true);

            const pMat = new BABYLON.StandardMaterial("qtyMat_" + i, scene);
            pMat.diffuseTexture = tex;
            pMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
            pMat.opacityTexture = tex;
            p.material = pMat;
        });

        const base = BABYLON.MeshBuilder.CreateBox("base", { width: 2.2, height: 0.1, depth: 1.2 }, scene);
        base.parent = root;
        base.position.y = 0.05;
        const bMat = new BABYLON.StandardMaterial("baseMat", scene);
        bMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);
        bMat.emissiveColor = new BABYLON.Color3(0, 0.2, 0.1);
        base.material = bMat;
    }
}
