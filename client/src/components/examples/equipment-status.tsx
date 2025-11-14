import { EquipmentStatus } from "../equipment-status";

export default function EquipmentStatusExample() {
  const mockEquipment = [
    {
      id: "1",
      name: "Treadmill #1",
      category: "Cardio",
      status: "operational" as const,
      nextMaintenance: new Date(2025, 11, 15),
    },
    {
      id: "2",
      name: "Bench Press",
      category: "Strength",
      status: "maintenance" as const,
      nextMaintenance: new Date(2025, 10, 5),
    },
  ];

  return (
    <div className="p-4">
      <EquipmentStatus
        equipment={mockEquipment}
        onScheduleMaintenance={(id) => console.log("Schedule maintenance", id)}
      />
    </div>
  );
}
