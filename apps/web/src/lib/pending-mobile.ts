/**
 * The mobile number verified on the login screen in local demo mode (no Firebase), kept for
 * this tab so the sign-up form can prefill it. With Firebase it comes from the signed-in user.
 */
const KEY = "arthmitra:mobile";

export function rememberMobile(mobile10: string) {
  try {
    sessionStorage.setItem(KEY, mobile10);
  } catch {
    // Storage blocked: the form just starts empty.
  }
}

export function pendingMobile(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
