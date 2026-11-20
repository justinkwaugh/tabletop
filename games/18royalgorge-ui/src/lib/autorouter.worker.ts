import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRulesRoyalGorge } from '@tabletop/18royalgorge'

serveAutorouter(RouteRulesRoyalGorge, solverUrl)
