# PROTOTYPE, throwaway: city tile flow

Question: how should a city tile animate as it is founded, expands a city, fills a notch, or merges
two cities?

Variants (`?variant=A|B|C|D`, `?compare=A,C,D` side by side, `?speed=0.25`):

- A Pour: the shared border bulges into the new hex as a liquid front.
- B Trace: the outline draws itself around the new hex, then the colour floods in.
- C Stretch: the hex inflates from the shared edge with a springy overshoot.
- D Springy pour: A's bulging front with a smaller overshoot.

Verdict (2026-10-03): D, shipped as `CityFlowAnimator` / `utils/cityFlow.ts` in Magna Grecia UI 0.14.0
to see what players think.

Run with `pnpm dev` in `games/magna-grecia-ui`, open `/prototype-city-flow`. The `recording/`
specs drove headless frame sheets and videos (they expect a dev server on port 5191; move them into
`tests/` to run).
