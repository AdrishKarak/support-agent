import { router } from './trpc';
import { classifyRouter } from './routers/classify';
import { retrieveRouter } from './routers/retrieve';
import { draftReplyRouter } from './routers/draftReply';
import { escalateRouter } from './routers/escalate';

export const appRouter = router({
  classify: classifyRouter,
  retrieve: retrieveRouter,
  draftReply: draftReplyRouter,
  escalate: escalateRouter,
});

export type AppRouter = typeof appRouter;
