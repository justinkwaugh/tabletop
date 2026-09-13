import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { Shikoku1889RouteRules } from '@tabletop/shikoku-1889'

serveAutorouter(Shikoku1889RouteRules, solverUrl)
