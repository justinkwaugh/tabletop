# Game logic lifecycle research

Summary of the measurements behind ADR 0011. The prototypes, raw samples and per-milestone
reports live outside the repository in `/workspace/tmp/game-runtime-experiments/game-runtime`
on the development host; they are disposable benchmarks, not product code.

## Candidates

- Resident ESM (the control): each generation imported into the process and never released.
- Collectible factories: each generation evaluated with `vm.compileFunction` outside the module
  cache and released by reference. **Chosen.**
- Native hosts: a minimal V8 embedder and a QuickJS embedder running a data-only action
  protocol out of process. QuickJS was excluded early on performance; V8 out of process cost a
  serialisation round trip per action and a second process to size.
- Node execution processes and bounded process pools: the same action protocol in a child
  Node process, with and without pooling.

## Findings

- Four real titles, 100 synthetic publications of one of them, one worker with a 256 MiB
  old-space limit and no forced GC: zero request errors, worker and supervisor PIDs unchanged,
  peak RSS 454 MiB, RSS between 406 and 442 MiB across the last twenty cycles, activation
  295 ms median and 481 ms p95 on the development host.
- Reachability diagnostic: 41 generations loaded through the production loader and validator
  ownership, 40 retired, 0 reachable after GC.
- Resident ESM with the same heap limit fails the run; the compilation cache keeps old scripts
  until GC pressure, so RSS falls later than the heap.
- Standalone AJV validators compiled at build time matched Fastify's runtime compiler on
  coercion, dates and error arrays. They were replaced by TypeBox validators compiled on first
  use, about 3 ms per action, which removed the build-time sidecar and a second validation
  semantics from the action path.

## Limits

- Measured on the development host with a four-title catalogue; the full production catalogue
  and the Cloud Run memory limit still need a measured heap budget.
- The synthetic generations change version identity only, not rules or state shape.
