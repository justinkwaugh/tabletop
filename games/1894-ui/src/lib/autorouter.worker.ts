import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { EighteenNinetyFourRouteRules } from '@tabletop/1894'

serveAutorouter(EighteenNinetyFourRouteRules, solverUrl)
