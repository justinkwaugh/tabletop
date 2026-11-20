import { MinorIdsMex, NdmId } from './companies.js'
import { PhasesMex, ThreeHalfPhaseId } from './trains.js'

/** The train limit: the phase's, the NdM's one higher from phase 3½; a minor's one (Table I). */
export function trainLimitMex(state: { phaseId: string }, companyId: string): number {
    if (MinorIdsMex.includes(companyId)) return 1
    const limit = PhasesMex.phase(state.phaseId).trainLimit
    return companyId === NdmId && PhasesMex.isAtLeast(state.phaseId, ThreeHalfPhaseId)
        ? limit + 1
        : limit
}
