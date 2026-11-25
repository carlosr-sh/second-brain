import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { Providers } from "./app/providers";
import { createAppRouter } from "./app/router";
import { createQueryClient } from "./lib/query-client";
import "./index.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

const queryClient = createQueryClient();
const router = createAppRouter();

createRoot(root).render(
  <StrictMode>
    <Providers queryClient={queryClient}>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>,
);
