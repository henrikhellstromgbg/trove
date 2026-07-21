export async function runOnce(
  lock: { current: boolean },
  task: () => Promise<void>
): Promise<boolean> {
  if (lock.current) return false;
  lock.current = true;
  try {
    await task();
    return true;
  } finally {
    lock.current = false;
  }
}
