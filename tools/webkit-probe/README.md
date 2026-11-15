# WebKit probe

`tools/webkit-probe` measures a game UI the way an iPhone pays for it: it opens a page in
Playwright WebKit as a 3x phone, then reports the web process's memory (steady and
peak, over a blank page), the board's repaint time, and the frames an interaction causes.
Each `--css` adds a run with that CSS injected, reported against the first, to put a cost on
one suspect at a time. Why and when to measure: `docs/phone-rendering.md`. Options and the
steps module's signature:

```bash
node tools/webkit-probe/src/cli.mjs --help
```

It reads memory with `ps` from the `WPEWebProcess` its own browser started, so it runs on
Linux, and concurrent probes do not see each other. A failing steps module leaves a
screenshot of the page in the temp directory.
