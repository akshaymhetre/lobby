import type { SetupStep } from "@lobby/core/settings";

export interface StepMeta {
  key: SetupStep;
  label: string;
  title: string;
  description: string;
  /** Rough time, shown in the step list so the whole setup feels finite. */
  minutes: number;
}

export const STEPS: StepMeta[] = [
  {
    key: "admin",
    label: "Administrator",
    title: "Create the administrator account",
    description: "This account works even when single sign-on does not, so you can always get back in. Keep the password somewhere safe.",
    minutes: 1,
  },
  {
    key: "company",
    label: "Company",
    title: "Make it look like your company",
    description: "Your name, logo and brand colour appear across Lobby. Any colour works: Lobby adjusts it so text stays readable.",
    minutes: 2,
  },
  {
    key: "identity",
    label: "Single sign-on",
    title: "Connect your identity provider",
    description: "Employees sign in with the account they already use. Lobby never sees or stores their passwords.",
    minutes: 4,
  },
  {
    key: "people",
    label: "People",
    title: "Bring in your people",
    description: "Sync the directory from your identity provider, import a CSV, or let accounts appear as people sign in.",
    minutes: 2,
  },
  {
    key: "apps",
    label: "Apps",
    title: "Add the apps people use every day",
    description: "Each one becomes a tile in the launcher. You can change links, icons and who sees them later.",
    minutes: 1,
  },
  {
    key: "content",
    label: "Starter content",
    title: "Start with something on the shelves",
    description: "Lobby can add sensible starting points that you edit, rather than an empty building.",
    minutes: 1,
  },
];

export const stepIndex = (key: SetupStep) => STEPS.findIndex((s) => s.key === key);
export const nextStepPath = (key: SetupStep) => {
  const i = stepIndex(key);
  return i < STEPS.length - 1 ? `/setup/${STEPS[i + 1]!.key}` : "/setup/done";
};
