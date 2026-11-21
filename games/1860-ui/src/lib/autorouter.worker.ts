import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1860 } from '@tabletop/1860'

serveAutorouter(RouteRules1860, solverUrl)
