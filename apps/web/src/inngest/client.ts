// In v0.4.0+, realtimeMiddleware is imported from /middleware subpath
import { realtimeMiddleware } from "@inngest/realtime/middleware";
import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "Shipper-AI",
  middleware: [realtimeMiddleware()],
});
