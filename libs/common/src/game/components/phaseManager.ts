import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable } from '../../util/hydration.js'
import { Phase } from '../model/phase.js'
import { findLast } from '../../util/findLast.js'

export type PhaseManager = Static<typeof PhaseManager>
export const PhaseManager = Type.Object({
    series: Type.Array(Phase)
})

export const PhaseManagerValidator = TypeCompiler.Compile(PhaseManager)

export class HydratedPhaseManager extends Hydratable<typeof PhaseManager> implements PhaseManager {
    declare series: Phase[]

    constructor(data: PhaseManager) {
        super(data, PhaseManagerValidator)
    }

    static generate(): HydratedPhaseManager {
        return new HydratedPhaseManager({
            series: []
        })
    }

    get currentPhase(): Phase | undefined {
        return findLast(this.series, (phase) => {
            return !phase.end
        })
    }

    startPhase(name: string, actionIndex: number = 0): Phase {
        const phase: Phase = {
            type: 'phase',
            start: actionIndex,
            name
        }
        this.series.push(phase)
        return phase
    }

    endPhase(actionIndex: number): Phase {
        if (this.series.length === 0) {
            throw Error(`Cannot end a phase when there are no phases`)
        }
        const phaseToEnd = this.series[this.series.length - 1]
        if (phaseToEnd.end !== undefined) {
            throw Error(`Phase has already ended`)
        }

        phaseToEnd.end = actionIndex
        return phaseToEnd
    }
}
