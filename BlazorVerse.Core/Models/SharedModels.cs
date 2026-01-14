namespace BlazorVerse.Core.Models
{
    public class EngineStats
    {
        public double Fps { get; set; }
        public string Resolution { get; set; } = "";
    }

    public class SelectionInfo
    {
        public string Name { get; set; } = "";
        public string Id { get; set; } = "";
        public double X { get; set; }
        public double Y { get; set; }
        public double Z { get; set; }
    }
}
