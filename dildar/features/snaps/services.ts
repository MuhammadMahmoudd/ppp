/**
 * Snap services: nothing long-lived is needed — incoming snaps are read on
 * the Camera page via Realtime (useIncomingSnaps) and plaintext temp files
 * are wiped on launch (lib/media wipeTemp) and when a viewer closes.
 */
export function useSnapsServices(): void {
  // intentionally empty
}
