import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1822 } from '@tabletop/1822'

serveAutorouter(RouteRules1822, solverUrl)
