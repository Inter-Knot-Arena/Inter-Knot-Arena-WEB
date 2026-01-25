import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { WorkQueueItem, WorkQueueTable } from "./WorkQueueTable";
import type { AdminRole } from "./AdminHeader";

interface WorkQueueTabsProps {
  role: AdminRole;
  reviews: WorkQueueItem[];
  disputes: WorkQueueItem[];
  reports: WorkQueueItem[];
  imports: WorkQueueItem[];
}

export function WorkQueueTabs({ role, reviews, disputes, reports, imports }: WorkQueueTabsProps) {
  const isAdmin = role === "admin";
  const isStaff = role === "staff";
  const isModer = role === "moder";
  const canAssign = isAdmin || isStaff;
  const showDisputes = isAdmin || isStaff;
  const showReports = isAdmin || isStaff;
  const showImports = isAdmin || isStaff;
  const moderAssignee = "moder_kris";
  const visibleReviews = isModer
    ? reviews.filter((item) => !item.assignee || item.assignee === moderAssignee)
    : reviews;

  return (
    <Tabs defaultValue="reviews" className="space-y-4">
      <TabsList className="w-full justify-start border border-border bg-ika-800/70 p-1">
        <TabsTrigger value="reviews">Reviews ({visibleReviews.length})</TabsTrigger>
        {showDisputes ? <TabsTrigger value="disputes">Disputes ({disputes.length})</TabsTrigger> : null}
        {showReports ? <TabsTrigger value="reports">Reports ({reports.length})</TabsTrigger> : null}
        {showImports ? <TabsTrigger value="imports">Imports ({imports.length})</TabsTrigger> : null}
      </TabsList>

      <TabsContent value="reviews">
        <WorkQueueTable items={visibleReviews} canAssign={canAssign} />
      </TabsContent>
      {showDisputes ? (
        <TabsContent value="disputes">
          <WorkQueueTable items={disputes} canAssign={canAssign} />
        </TabsContent>
      ) : null}
      {showReports ? (
        <TabsContent value="reports">
          <WorkQueueTable items={reports} canAssign={canAssign} />
        </TabsContent>
      ) : null}
      {showImports ? (
        <TabsContent value="imports">
          <WorkQueueTable items={imports} canAssign={canAssign} />
        </TabsContent>
      ) : null}
    </Tabs>
  );
}
