const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

export function isValidUsername(username) {
  return USERNAME_REGEX.test(String(username).trim());
}

export function normalizeUsername(username) {
  return String(username).trim();
}

export function usernameToEmail(username) {
  return `${String(username).trim().toLowerCase()}@wilderness-bingo.app`;
}
