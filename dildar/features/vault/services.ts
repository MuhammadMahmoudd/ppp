/**
 * Vault services: re-lock the vault (and drop decrypted thumbnails from
 * memory) whenever the app leaves the foreground.
 */
import { useEffect } from 'react';
import { installVaultAutoLock } from './vaultSession';

export function useVaultServices(): void {
  useEffect(() => installVaultAutoLock(), []);
}
