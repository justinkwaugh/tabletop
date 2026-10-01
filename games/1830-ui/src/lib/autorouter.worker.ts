import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { EighteenThirtyRouteRules } from '@tabletop/1830'

serveAutorouter(EighteenThirtyRouteRules, solverUrl)
