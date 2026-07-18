HOW TO USE THIS FOLDER
======================

Everything in here goes into your solmates-web folder, keeping the exact
same structure.

1. Unzip it.

2. Open the unzipped folder. Select EVERYTHING inside it EXCEPT the two
   files starting with an underscore (_READ_ME_FIRST.txt and
   _ENV_TEMPLATE.txt).

3. Copy, then paste into your solmates-web folder.

4. Windows will ask about replacing files. Say YES / "Replace the files
   in the destination". It's meant to replace three of them:
       app/layout.tsx
       app/page.tsx
       app/globals.css

5. Make your .env.local file -- see _ENV_TEMPLATE.txt

6. In VS Code's terminal:
       npm install @supabase/supabase-js @supabase/ssr lucide-react qrcode.react
       npm run dev

7. Open http://localhost:3000


WHAT SHOULD BE WHERE
====================

After pasting, solmates-web should contain:

    app/            <- was already there, now has our screens in it
    components/     <- new
    lib/            <- new
    middleware.ts   <- new, sits in the ROOT next to package.json
    .env.local      <- you make this
    package.json    <- was already there
    node_modules/   <- was already there

If middleware.ts ends up inside app/ it does nothing at all, silently,
and you get logged out at random moments. It goes in the root.
