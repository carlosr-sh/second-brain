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
const ModulePlaceholderPage = lazy(() =>
  import("@/pages/module-placeholder-page").then((m) => ({ default: m.ModulePlaceholderPage })),
);

const IMPLEMENTED: Record<string, LazyExoticComponent<ComponentType>> = {
  dashboard: DashboardPage,
  inbox: InboxPage,
};

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
  m.path === "/" ? { index: true, element: moduleElement(m) } : { path: `${m.path.slice(1)}/*`, element: moduleElement(m) },
);

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        errorElement: <RouteErrorPage />,
        children: [...moduleRoutes, { path: "settings", element: withSuspense(<SettingsPage />) }, { path: "*", element: <NotFoundPage /> }],
      },
    ],
  },
];

export const createAppRouter = () => createBrowserRouter(routes);
