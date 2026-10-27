import { buildPreview } from "./build-preview.mjs";
import { createPreviewServer } from "./preview-server.mjs";
await buildPreview();
const server = await createPreviewServer();
server.listen(Number(process.env.PORT) || 5173, "127.0.0.1", () =>
  console.log(
    `TableTap local preview: http://127.0.0.1:${server.address().port}\nSign-in codes appear on screen unless RESEND_API_KEY and EMAIL_FROM are set.`,
  ),
);
