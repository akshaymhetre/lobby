/**
 * The front door's route group (sign-in, signed-out). Each page renders <FrontDoor> itself, because
 * the door's picture differs by page: lit on sign-in, closed after sign-out.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
