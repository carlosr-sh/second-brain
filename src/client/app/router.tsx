import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/layout/app-shell";
import { Page } from "@/layout/page";
import { NotFoundPage, RouteErrorPage } from "@/pages/error-pages";
import { NAV_GROUPS, type NavModule } from "./navigation";

/*
 * Route-level code splitting: every page is its own chunk, downloaded on first
 * visit. Mandatory for heavy modules to come (Tiptap editor, Recharts).
 */
const DashboardPage = lazy(() => import("@/pages/dashboard-page").then((m) => ({ default: m.DashboardPage })));
const InboxPage = lazy(() => import("@/pages/inbox-page").then((m) => ({ default: m.InboxPage })));
const SettingsPage = lazy(() => import("@/pages/settings-page").then((m) => ({ default: m.SettingsPage })));
const TasksPage = lazy(() => import("@/pages/tasks-page").then((m) => ({ default: m.TasksPage })));
const ProjectsPage = lazy(() => import("@/pages/projects-page").then((m) => ({ default: m.ProjectsPage })));
const ProjectDetailPage = lazy(() => import("@/pages/project-detail-page").then((m) => ({ default: m.ProjectDetailPage })));
const AreasPage = lazy(() => import("@/pages/areas-page").then((m) => ({ default: m.AreasPage })));
const AreaDetailPage = lazy(() => import("@/pages/area-detail-page").then((m) => ({ default: m.AreaDetailPage })));
const GoalsPage = lazy(() => import("@/pages/goals-page").then((m) => ({ default: m.GoalsPage })));
const ArchivePage = lazy(() => import("@/pages/archive-page").then((m) => ({ default: m.ArchivePage })));
const NotesPage = lazy(() => import("@/pages/notes-page").then((m) => ({ default: m.NotesPage })));
const libraryPage = <K extends "NotebooksPage" | "TagsPage" | "ResourcesPage" | "ResourceDetailPage" | "BookmarksPage" | "BookshelfPage">(name: K) =>
  lazy(() => import("@/pages/library-pages").then((m) => ({ default: m[name] })));
const NotebooksPage = libraryPage("NotebooksPage");
const TagsPage = libraryPage("TagsPage");
const ResourcesPage = libraryPage("ResourcesPage");
const ResourceDetailPage = libraryPage("ResourceDetailPage");
const BookmarksPage = libraryPage("BookmarksPage");
const BookshelfPage = libraryPage("BookshelfPage");
const FinancePage = lazy(() => import("@/pages/finance-page").then((m) => ({ default: m.FinancePage })));
const HabitsPage = lazy(() => import("@/pages/habits-page").then((m) => ({ default: m.HabitsPage })));
const JournalPage = lazy(() => import("@/pages/journal-page").then((m) => ({ default: m.JournalPage })));
const ContactsPage = lazy(() => import("@/pages/contacts-page").then((m) => ({ default: m.ContactsPage })));
const ContactDetailPage = lazy(() => import("@/pages/contacts-page").then((m) => ({ default: m.ContactDetailPage })));
const ModulePlaceholderPage = lazy(() =>
  import("@/pages/module-placeholder-page").then((m) => ({ default: m.ModulePlaceholderPage })),
);

const IMPLEMENTED: Record<string, LazyExoticComponent<ComponentType>> = {
  dashboard: DashboardPage,
  inbox: InboxPage,
  tasks: TasksPage,
  projects: ProjectsPage,
  areas: AreasPage,
  goals: GoalsPage,
  archive: ArchivePage,
  notes: NotesPage,
  notebooks: NotebooksPage,
  tags: TagsPage,
  resources: ResourcesPage,
  bookmarks: BookmarksPage,
  bookshelf: BookshelfPage,
  finance: FinancePage,
  habits: HabitsPage,
  journal: JournalPage,
  contacts: ContactsPage,
};

/** Detail routes nested under a module path. */
const detailRoutes = (): RouteObject[] => [
  { path: "projects/:id", element: withSuspense(<ProjectDetailPage />) },
  { path: "areas/:id", element: withSuspense(<AreaDetailPage />) },
  { path: "notes/:id", element: withSuspense(<NotesPage />) },
  { path: "resources/:id", element: withSuspense(<ResourceDetailPage />) },
  { path: "journal/:date", element: withSuspense(<JournalPage />) },
  { path: "contacts/:id", element: withSuspense(<ContactDetailPage />) },
];

function PageFallback() {
  return (
    <Page>
      <Skeleton className="mb-3 h-8 w-48" />
      <Skeleton className="h-4 w-72" />
    </Page>
  );
}

const withSuspense = (node: React.ReactNode) => <Suspense fallback={<PageFallback />}>{node}</Suspense>;

function moduleElement(m: NavModule) {
  const Implemented = IMPLEMENTED[m.id];
  return withSuspense(Implemented ? <Implemented /> : <ModulePlaceholderPage module={m} />);
}

const moduleRoutes: RouteObject[] = NAV_GROUPS.flatMap((g) => g.modules).map((m) =>
  m.path === "/" ? { index: true, element: moduleElement(m) } : { path: IMPLEMENTED[m.id] ? m.path.slice(1) : `${m.path.slice(1)}/*`, element: moduleElement(m) },
);

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [...moduleRoutes, ...detailRoutes(), { path: "settings", element: withSuspense(<SettingsPage />) }, { path: "*", element: <NotFoundPage /> }],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
