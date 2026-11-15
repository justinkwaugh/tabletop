import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1882 } from '@tabletop/1882'

serveAutorouter(RouteRules1882, solverUrl)
