import { auth } from "@clerk/nextjs/server";
import {
  createConnectedAccount,
  listConnectedAccounts,
} from "@/lib/sources/store";

export const sourceAccountDeps = {
  auth,
  listConnectedAccounts,
  createConnectedAccount,
};
