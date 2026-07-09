import { DashboardPage } from "@/components/layout/dashboard-page";
import { WebDemandsKanbanBoard } from "@/components/web-demands/web-demands-kanban-board";

export default function WebDemandsPage() {
  return (
    <DashboardPage
      title="Demandas Web"
      description="Quadro Kanban para demandas de projetos web"
    >
      <div className="-mx-8 px-8 lg:-mx-10 lg:px-10 overflow-x-auto">
        <WebDemandsKanbanBoard />
      </div>
    </DashboardPage>
  );
}
