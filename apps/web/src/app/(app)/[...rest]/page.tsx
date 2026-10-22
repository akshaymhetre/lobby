import { NotFoundTrigger } from "./not-found-trigger";

/**
 * Unknown URLs inside the app get the in-shell 404 (with the top bar and search), not the bare front-door one.
 *
 * The not-found signal is thrown from a client component, not from this server component. A server
 * component that throws `notFound()` is recorded as an errored Server Component, and React 19's dev
 * performance track then calls `performance.measure` with an end time before the page's time origin:
 * an uncaught TypeError ("'CatchAll' cannot have a negative time stamp") that showed as the Next dev
 * overlay's "1 Issue" on every 404. Thrown during SSR from the client tree, the response is still a 404.
 */
export default function CatchAll() {
  return <NotFoundTrigger />;
}
