import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1828 } from '@tabletop/1828'

serveAutorouter(RouteRules1828, solverUrl)
