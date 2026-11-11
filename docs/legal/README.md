# Privacy policy and terms of service

The site shows a privacy policy at `/privacy` and terms of service at `/terms`. The text belongs to whoever runs a deployment, so it never lives in this repository: a fork would otherwise publish someone else's identity, contact details and processors.

## How a deployment supplies them

Put two Markdown files in `apps/frontend/legal/`, which is gitignored:

- `apps/frontend/legal/privacy.md`
- `apps/frontend/legal/terms.md`

The frontend build converts whichever exist to HTML (`apps/frontend/legalDocumentsPlugin.ts`), so the site never ships a Markdown parser. The site builds into a single JavaScript file, so that HTML loads with every page; don't embed images in it. `vite dev` reloads when a document is added, edited or removed. A missing file leaves its page saying the site hasn't published one yet; the site never falls back to anyone else's text. `release-frontend` prints which documents it found before building.

The page shows its own title ("Privacy Policy", "Terms of Service"), so start each document with its content or a `##` section heading, not a `#` title.

When releasing from a checkout that lacks the folder, such as a T3 worktree, symlink it from the main checkout (`ln -s <main checkout>/apps/frontend/legal apps/frontend/legal`), as with `apps/frontend/.env.production`. The ignore rule matches the symlink too, so the tree stays clean.

## Starting points

- [`privacy-policy.template.md`](privacy-policy.template.md) and [`terms.template.md`](terms.template.md) outline what each document must cover, with `{{placeholders}}` for deployment facts. Copy them into `apps/frontend/legal/`, fill every placeholder, and remove the guidance notes. Never publish a template unfilled.
- [`../privacy/data-inventory.md`](../privacy/data-inventory.md) describes what the software collects, where it goes and how long it is kept. Check it against your own deployment's services and settings.

These files are a starting point, not legal advice.
