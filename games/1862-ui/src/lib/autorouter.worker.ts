import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRules1862 } from '@tabletop/1862'

serveAutorouter(RouteRules1862, solverUrl)
