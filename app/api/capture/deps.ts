import { auth } from "@clerk/nextjs/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";
import { inngest } from "@/lib/inngest/client";
import { requireProjectId } from "@/lib/projects";

export const captureDeps = { auth, put, db, inngest, requireProjectId };
