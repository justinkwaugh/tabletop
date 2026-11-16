import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { RouteRulesChesapeake } from '@tabletop/18chesapeake'

serveAutorouter(RouteRulesChesapeake, solverUrl)
