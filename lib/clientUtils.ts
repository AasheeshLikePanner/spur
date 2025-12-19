const USER_NAME_LOCAL_STORAGE_KEY = 'spur_chat_user_name';
const USER_NAME_DISPLAY_KEY = 'spur_chat_user_name_display';

/**
 * Retrieves the user name from localStorage (lowercase for DB queries).
 * Returns null if not found.
 */
export function getStoredUserName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_NAME_LOCAL_STORAGE_KEY);
}

/**
 * Retrieves the display name from localStorage (original capitalization).
 * Returns null if not found.
 */
export function getStoredDisplayName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(USER_NAME_DISPLAY_KEY) || getStoredUserName();
}

/**
 * Stores the user name in localStorage.
 * Saves both lowercase (for DB) and original (for display).
 */
export function setStoredUserName(name: string) {
  if (typeof window === 'undefined') return;
  const trimmedName = name.trim();
  localStorage.setItem(USER_NAME_LOCAL_STORAGE_KEY, trimmedName.toLowerCase());
  localStorage.setItem(USER_NAME_DISPLAY_KEY, trimmedName);
}
