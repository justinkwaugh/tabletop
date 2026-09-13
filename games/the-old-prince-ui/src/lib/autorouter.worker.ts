import { serveAutorouter } from '@tabletop/18xx-autorouter'
import solverUrl from '@tabletop/18xx-autorouter/solver.wasm?url'
import { TheOldPrinceRouteRules } from '@tabletop/the-old-prince'

serveAutorouter(TheOldPrinceRouteRules, solverUrl)
