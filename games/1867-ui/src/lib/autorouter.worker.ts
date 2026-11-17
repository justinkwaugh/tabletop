import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1867 } from '@tabletop/1867'

serveAutorouter(RouteRules1867, solverUrl)
