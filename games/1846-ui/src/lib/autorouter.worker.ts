import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1846 } from '@tabletop/1846'
serveAutorouter(RouteRules1846, solverUrl)
