const USER_NAME_LOCAL_STORAGE_KEY = 'spur_chat_user_name';

/**
 * Retrieves the user name from localStorage.
 * Returns null if not found.
 */
export function getStoredUserName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_NAME_LOCAL_STORAGE_KEY);
}

/**
 * Stores the user name in localStorage.
 */
export function setStoredUserName(name: string) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(USER_NAME_LOCAL_STORAGE_KEY, name.trim());
}
