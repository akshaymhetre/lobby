/**
 * Password strength for the break-glass admin. Pure, so the wizard can show the hint as you type
 * and the server can enforce the same rule.
 */

export const MIN_PASSWORD_LENGTH = 12;

const COMMON = [
  "password", "123456", "qwerty", "letmein", "welcome", "admin", "iloveyou", "monkey", "dragon",
  "football", "baseball", "abc123", "111111", "sunshine", "princess", "lobby", "changeme", "secret",
];

export interface PasswordStrength {
  /** 0 (unusable) to 4 (strong). */
  score: 0 | 1 | 2 | 3 | 4;
  label: "Too short" | "Weak" | "Fair" | "Good" | "Strong";
  /** One plain sentence telling the person what would make it better. */
  hint: string;
  acceptable: boolean;
}

export function passwordStrength(password: string, context: string[] = []): PasswordStrength {
  const pw = password ?? "";
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return {
      score: 0,
      label: "Too short",
      hint: `Use at least ${MIN_PASSWORD_LENGTH} characters. A few unrelated words work well.`,
      acceptable: false,
    };
  }
  const lower = pw.toLowerCase();
  const words = [...COMMON, ...context.map((c) => c.toLowerCase()).filter((c) => c.length >= 4)];
  if (words.some((w) => lower.includes(w))) {
    return {
      score: 1,
      label: "Weak",
      hint: "Avoid common words, your company name and your email address.",
      acceptable: false,
    };
  }
  if (/^(.)\1+$/.test(pw) || /^(0123456789|1234567890|abcdefghijkl)/i.test(pw)) {
    return { score: 1, label: "Weak", hint: "Avoid repeated or sequential characters.", acceptable: false };
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const unique = new Set(pw).size;
  let points = 0;
  if (pw.length >= 16) points++;
  if (pw.length >= 20) points++;
  if (classes >= 3) points++;
  if (unique >= 10) points++;
  if (points <= 1) {
    return { score: 2, label: "Fair", hint: "Longer is stronger. Add another word or two.", acceptable: true };
  }
  if (points === 2 || points === 3) {
    return { score: 3, label: "Good", hint: "Store it in your password manager.", acceptable: true };
  }
  return { score: 4, label: "Strong", hint: "Store it in your password manager.", acceptable: true };
}
