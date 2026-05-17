import { Inngest } from "inngest";

export const inngest = new Inngest({
  id: "trove",
  isDev: process.env.NODE_ENV !== "production",
});
