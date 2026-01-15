using System.Text.Json.Serialization;

namespace BlazorVerse.Core.Models
{
    public class EngineStats
    {
        public double Fps { get; set; }
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
        public int MeshCount { get; set; }
        public string CameraType { get; set; } = "";
        public string LightType { get; set; } = "";
        public string Resolution { get; set; } = "";
        public int Vertices { get; set; }
    }

    public class SelectionInfo
    {
        public string Name { get; set; } = "";
        public string Id { get; set; } = "";
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
        public EntityMetadata? Metadata { get; set; }
    }

    public class AssetInfo
    {
        public string Id { get; set; } = "";
        public string Name { get; set; } = "";
    }

    public class AssetManifestItem
    {
        public string Id { get; set; } = "";
        public string Path { get; set; } = "";
    }

    public class EntityMetadata
    {
        [JsonPropertyName("ownerName")]
        public string? OwnerName { get; set; }
        
        [JsonPropertyName("style")]
        public string? Style { get; set; }

        [JsonPropertyName("inventoryId")]
        public string? InventoryId { get; set; }
        
        [JsonPropertyName("spawner")]
        public SpawnerData? Spawner { get; set; }

        [JsonPropertyName("dashboard")]
        public DashboardData? Dashboard { get; set; }
    }

    public class DashboardData
    {
        [JsonPropertyName("dataFile")]
        public string DataFile { get; set; } = "";

        [JsonPropertyName("type")]
        public string Type { get; set; } = "";
    }

    public class SpawnerData
    {
        [JsonPropertyName("spawnType")]
        public string SpawnType { get; set; } = "goblin";
        
        [JsonPropertyName("frequency")]
        public int Frequency { get; set; } = 10;
    }
}
