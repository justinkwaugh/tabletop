import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1880 } from '@tabletop/1880'

serveAutorouter(RouteRules1880, solverUrl)
