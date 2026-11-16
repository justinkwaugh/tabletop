import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1856 } from '@tabletop/1856'

serveAutorouter(RouteRules1856, solverUrl)
