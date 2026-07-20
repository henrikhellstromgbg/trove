import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import {
  ingestItem,
  clusterTopics,
  weeklyDigest,
  runDuePipelines,
  syncDueSources,
} from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [ingestItem, clusterTopics, weeklyDigest, runDuePipelines, syncDueSources],
});
