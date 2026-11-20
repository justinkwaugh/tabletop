import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRulesMex } from '@tabletop/18mex'

serveAutorouter(RouteRulesMex, solverUrl)
