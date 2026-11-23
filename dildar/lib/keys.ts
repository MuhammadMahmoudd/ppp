/**
 * Device keypair lifecycle: generate → Keychain, publish public key,
 * optional passphrase backup → key_backups (ciphertext only), restore.
 */
import { createKeyBackup, generateKeyPair, publicKeyFromSecret, restoreKeyBackup, type KeyPairB64 } from './crypto';
import { secret } from './secureStorage';
import { api } from './api';

const skName = (userId: string) => `dildar.sk.${userId}`;

export async function loadLocalKeyPair(userId: string): Promise<KeyPairB64 | null> {
  const sk = await secret.get(skName(userId));
  if (!sk) return null;
  return { secretKey: sk, publicKey: publicKeyFromSecret(sk) };
}

async function saveLocal(userId: string, kp: KeyPairB64): Promise<void> {
  await secret.set(skName(userId), kp.secretKey);
}

export async function publishPublicKey(userId: string, publicKey: string): Promise<void> {
  const { error } = await api.from('profiles').update({ public_key: publicKey }).eq('user_id', userId);
  if (error) throw error;
}

export async function createAndPublishKeyPair(userId: string): Promise<KeyPairB64> {
  const kp = generateKeyPair();
  await saveLocal(userId, kp);
  await publishPublicKey(userId, kp.publicKey);
  return kp;
}

export async function hasRemoteBackup(userId: string): Promise<boolean> {
  const { data } = await api.from('key_backups').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

export async function uploadBackup(userId: string, kp: KeyPairB64, passphrase: string): Promise<void> {
  // PBKDF2 is CPU-heavy: yield a frame so the "working…" UI can render first.
  await new Promise((r) => setTimeout(r, 50));
  const b = createKeyBackup(kp.secretKey, passphrase);
  const { error } = await api.from('key_backups').upsert({
    user_id: userId,
    public_key: b.publicKey,
    salt: b.salt,
    nonce: b.nonce,
    ciphertext: b.ciphertext,
    iterations: b.iterations,
  });
  if (error) throw error;
}

export async function restoreFromBackup(userId: string, passphrase: string): Promise<KeyPairB64> {
  const { data, error } = await api.from('key_backups').select('*').eq('user_id', userId).single();
  if (error || !data) throw error ?? new Error('no_backup');
  await new Promise((r) => setTimeout(r, 50));
  const kp = restoreKeyBackup(data, passphrase); // throws CryptoError('wrong_passphrase')
  await saveLocal(userId, kp);
  await publishPublicKey(userId, kp.publicKey);
  return kp;
}

export async function forgetLocalKey(userId: string): Promise<void> {
  await secret.remove(skName(userId));
}
