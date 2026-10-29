import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1833NE } from '@tabletop/1833ne'

serveAutorouter(RouteRules1833NE, solverUrl)
