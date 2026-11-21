import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { EighteenUSARouteRules } from '@tabletop/18usa'

serveAutorouter(EighteenUSARouteRules, solverUrl)
