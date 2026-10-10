import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { EighteenThirtyTwoRouteRules } from '@tabletop/1832'

serveAutorouter(EighteenThirtyTwoRouteRules, solverUrl)
