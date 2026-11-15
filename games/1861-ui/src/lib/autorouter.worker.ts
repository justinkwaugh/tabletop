import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1861 } from '@tabletop/1861'

serveAutorouter(RouteRules1861, solverUrl)
