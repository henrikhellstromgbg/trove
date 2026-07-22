"use client";

import { useRef, useState } from "react";
import { AskChat } from "./ask-chat";

// Owns thread switching for the Ask view. It never uses router.push /
// useSearchParams (those interact badly with Next's router cache and freeze
// state — see the router-cache note); instead it drives AskChat via a `key`
// remount and writes the URL with history.replaceState directly.
export function AskWorkspace({
  projectId,
  slug,
  projectName,
}: {
  projectId: string;
  slug: string;
  projectName: string;
}) {
  // Read the initial thread from the URL once, synchronously, at mount.
  const initialId =
    typeof window === "undefined"
      ? null
      : new URLSearchParams(window.location.search).get("conversation");

  // threadKey drives AskChat's remount on deliberate switches. When it is a real
  // uuid it doubles as the thread to load; a "new-N" key means a blank thread.
  const [threadKey, setThreadKey] = useState<string>(initialId ?? "new-0");
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [listVersion, setListVersion] = useState(0);
  const newCount = useRef(0);

  function setUrlConversation(id: string | null) {
    const url = new URL(window.location.href);
    url.searchParams.delete("q");
    if (id) url.searchParams.set("conversation", id);
    else url.searchParams.delete("conversation");
    window.history.replaceState(null, "", url);
  }

  // Open an existing thread: remount AskChat so its mount effect reloads it.
  function pick(id: string) {
    if (id === activeId && threadKey === id) return;
    setActiveId(id);
    setThreadKey(id);
    setUrlConversation(id);
  }

  // Start a blank thread. The "new-N" key remounts even from new → new.
  function startNew() {
    newCount.current += 1;
    setActiveId(null);
    setThreadKey(`new-${newCount.current}`);
    setUrlConversation(null);
  }

  // AskChat created a thread mid-stream. Mark it active and refresh the list,
  // but do NOT change threadKey — that would remount and kill the live stream.
  function onConversationChange(id: string) {
    setActiveId(id);
    setListVersion((v) => v + 1);
    setUrlConversation(id);
  }

  const initialConversationId = threadKey.startsWith("new-") ? null : threadKey;

  return (
    <AskChat
      key={threadKey}
      projectId={projectId}
      slug={slug}
      projectName={projectName}
      initialConversationId={initialConversationId}
      activeId={activeId}
      listVersion={listVersion}
      onPick={pick}
      onNew={startNew}
      onConversationChange={onConversationChange}
    />
  );
}
