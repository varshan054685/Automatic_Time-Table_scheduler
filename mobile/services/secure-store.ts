/**
 * Secure credential storage (Expo SecureStore).
 *
 * Stores ONLY the Passport `connect.sid` session cookie — never passwords,
 * never API keys, never database credentials. The user/workspace snapshot is
 * stored in local SQLite (non-sensitive) so the app can boot offline.
 */
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const KEY_SESSION_COOKIE = "timetable.session.cookie";
const KEY_HAS_SESSION = "timetable.session.exists";

const IS_NATIVE = Platform.OS !== "web";

async function read(key: string): Promise<string | null> {
  if (!IS_NATIVE) return null;
  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn(`[SecureStore] read failed for ${key}`, err);
    return null;
  }
}

async function write(key: string, value: string): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn(`[SecureStore] write failed for ${key}`, err);
  }
}

async function remove(key: string): Promise<void> {
  if (!IS_NATIVE) return;
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn(`[SecureStore] delete failed for ${key}`, err);
  }
}

/** Full Cookie header value, e.g. `connect.sid=s%3Aabc123.xyz`. */
export async function getSessionCookie(): Promise<string | null> {
  return read(KEY_SESSION_COOKIE);
}

export async function setSessionCookie(cookieValue: string): Promise<void> {
  await write(KEY_SESSION_COOKIE, cookieValue);
  await write(KEY_HAS_SESSION, "1");
}

export async function clearSessionCookie(): Promise<void> {
  await remove(KEY_SESSION_COOKIE);
  await remove(KEY_HAS_SESSION);
}

export async function hasSessionCookie(): Promise<boolean> {
  return (await read(KEY_HAS_SESSION)) === "1";
}
