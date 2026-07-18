import { redirect } from "next/navigation";

// REPLACES the Next.js welcome page.
// "/" isn't a screen in this app — signed-in people belong in the deck,
// and middleware.ts bounces everyone else to /login before this runs.

export default function Home() {
  redirect("/discover");
}
