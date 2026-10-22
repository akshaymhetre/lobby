import { BookOpen, Building2, KeyRound, LayoutGrid, ShieldCheck, Users, type LucideIcon } from "lucide-react";

/** One glyph per wizard step: shown on the step's header disc and again on the finish page. */
export const STEP_ICONS: Record<string, LucideIcon> = {
  admin: ShieldCheck,
  company: Building2,
  identity: KeyRound,
  people: Users,
  apps: LayoutGrid,
  content: BookOpen,
};
