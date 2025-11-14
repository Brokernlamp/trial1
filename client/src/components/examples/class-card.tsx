import { ClassCard } from "../class-card";

export default function ClassCardExample() {
  return (
    <div className="p-4 max-w-md">
      <ClassCard
        id="1"
        name="Morning Yoga"
        type="Yoga"
        trainerName="Sarah Johnson"
        startTime={new Date(2025, 9, 31, 7, 0)}
        endTime={new Date(2025, 9, 31, 8, 0)}
        capacity={20}
        enrolled={15}
        onViewDetails={(id) => console.log("View details", id)}
        onManageEnrollment={(id) => console.log("Manage enrollment", id)}
      />
    </div>
  );
}
