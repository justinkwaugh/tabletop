import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1849 } from '@tabletop/1849'

serveAutorouter(RouteRules1849, solverUrl)
