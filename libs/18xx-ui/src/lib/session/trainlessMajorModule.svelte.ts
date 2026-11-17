import { DecideTrainlessMajor, type HydratedEighteenXXState } from '@tabletop/18xx'
import { assertExists } from '@tabletop/common'
import type { AwaitedDecision, DecisionNames } from '../table/awaitedDecision.js'
import type { ModuleSession } from './moduleSession.js'

export type TrainlessMajorSession = ModuleSession<HydratedEighteenXXState, unknown>

/**
 * The director of a major company left without a train as a phase begins chooses whether it is
 * nationalised (1861 §11, 1867 GTG §10).
 */
export class TrainlessMajorModule {
    constructor(private readonly session: TrainlessMajorSession) {}

    /** The trainless major company whose director decides now. */
    readonly companyId = $derived.by(() => {
        if (
            !this.session.interactive ||
            !this.session.validActionTypes.includes('DecideTrainlessMajor')
        )
            return undefined
        return this.session.state.trainlessMajors?.companyIds[0]
    })
    async decide(nationalise: boolean): Promise<void> {
        const companyId = this.companyId
        assertExists(companyId, 'A trainless company is deciding')
        await this.session.applyAction(
            this.session.createPlayerAction(DecideTrainlessMajor, { companyId, nationalise })
        )
    }

    awaitedDecision(
        state: HydratedEighteenXXState,
        names: DecisionNames
    ): AwaitedDecision | undefined {
        const trainless = state.trainlessMajors?.companyIds[0]
        if (state.machineState !== 'NationalisingTrainless' || !trainless) return undefined
        const waiting = state.activePlayerIds.map((id) => names.playerName(id)).join(', ')
        return {
            title: 'Nationalisation',
            companyId: trainless,
            text: `${waiting} decides whether ${names.companyName(trainless)}, without a train, is nationalised.`
        }
    }
}
