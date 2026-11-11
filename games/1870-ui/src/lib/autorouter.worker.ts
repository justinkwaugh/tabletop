import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1870 } from '@tabletop/1870'

serveAutorouter(RouteRules1870, solverUrl)
