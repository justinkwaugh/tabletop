import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1850 } from '@tabletop/1850'

serveAutorouter(RouteRules1850, solverUrl)
