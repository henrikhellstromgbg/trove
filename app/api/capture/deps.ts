import { auth } from "@clerk/nextjs/server";
import { storeUpload } from "@/lib/files";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { requireProjectId } from "@/lib/projects";

export const captureDeps = { auth, storeUpload, db, inngest, requireProjectId };
