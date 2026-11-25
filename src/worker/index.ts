import "../shared/zod-setup";
import { createApp } from "./app";

const app = createApp();

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
