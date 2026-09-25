import { DashboardPage } from "@/components/layout/dashboard-page";
import { WebDemandsKanbanBoard } from "@/components/web-demands/web-demands-kanban-board";

export default function WebDemandsPage() {
  return (
    <DashboardPage
      title="Demandas Web"
      description="Quadro Kanban para demandas de projetos web — arraste os cards entre as colunas."
    >
      <div className="-mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 xl:-mx-10 xl:px-10">
        <WebDemandsKanbanBoard />
      </div>
    </DashboardPage>
  );
}
