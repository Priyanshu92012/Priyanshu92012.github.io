// Cloudflare Worker entry for PRIYANSHU.AI. Only the default export lives here:
// workerd treats every named export of the entry module as an entrypoint.
import { handle, type Env } from './app';

export default {
  fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return handle(req, env, ctx);
  },
} satisfies ExportedHandler<Env>;
