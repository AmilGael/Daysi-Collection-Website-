import { notFound, redirect } from "next/navigation";
import { currentViewer, type Viewer } from "@/lib/auth/session";

/**
 * Who may be in the office, decided in one place.
 *
 * Gated twice over: the viewer must be signed in, and their address must be
 * the owner address. A client who guesses the URL gets the same 404 as a page
 * that does not exist. A 403 would confirm there is something here to find.
 *
 * The layout calls this for the shell, and every tab page calls it again as
 * its first line: a layout does not re-render when the reader moves between
 * sibling tabs, so on its own it would keep the shell up after a session
 * lapsed. The pages are what re-run on every navigation.
 */
export async function officeViewer(locale: string): Promise<Viewer> {
  const viewer = await currentViewer();
  if (!viewer) redirect(`/${locale}/sign-in`);
  if (viewer.role !== "owner") notFound();
  return viewer;
}
