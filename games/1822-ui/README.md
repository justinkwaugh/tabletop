# 1822 UI

`@tabletop/1822-ui` is the Svelte Game Client for 1822: The Railways of Great Britain. It uses the
logic in `@tabletop/1822` and the shared 18xx table from `@tabletop/18xx-ui`. The map is the
boardless presentation. `pnpm --filter @tabletop/1822-ui dev` serves the standalone harness on
port 4222. `node scripts/generate-logos.mjs` rewrites the company tokens from the logic package's
companies.

The cover, `src/lib/images/cover.webp`, is the published box art from the All-Aboard Games shop
(`1822_cover.png` on the product page for 1822: The Railways of Great Britain), fitted to 513 by
657 with its own border colour above and below. It is in use for now and has not been cleared
with the publisher.
