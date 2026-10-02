import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { EighteenSeventeenRouteRules } from '@tabletop/1817'

serveAutorouter(EighteenSeventeenRouteRules, solverUrl)
