import { auth } from "@clerk/nextjs/server";
import { requireProjectId } from "@/lib/projects";
import {
  applyReviewDecision,
  listReviewItems,
  listTrashItems,
  moveItemToTrash,
  permanentlyDeleteItem,
  restoreItem,
} from "@/lib/review-or-deletion/store";
import { moveItemToProject } from "@/lib/items/move";

export const itemRouteDeps = {
  auth,
  requireProjectId,
  listReviewItems,
  applyReviewDecision,
  listTrashItems,
  moveItemToTrash,
  restoreItem,
  permanentlyDeleteItem,
  moveItemToProject,
};
