import { assertExists, type GameAction } from '@tabletop/common'
import type { BaseSession } from './moduleSession.js'

type StopRightsSession = {
    readonly canChooseAction: boolean
    readonly validActionTypes: readonly string[]
    readonly gameState: { trackStep?: { companyId: string } }
    applyAction: BaseSession['applyAction']
}

/** Buying a token for a stop that needs one, as 1832's coal fields and 1850's Mesabi Range do. */
export class StopRightsActions {
    readonly canBuy: boolean = $derived.by(
        () =>
            this.session.canChooseAction && this.session.validActionTypes.includes(this.actionType)
    )
    constructor(
        private readonly session: StopRightsSession,
        private readonly actionType: string,
        private readonly createAction: (companyId: string) => GameAction
    ) {}
    async buy(): Promise<void> {
        const companyId = this.session.gameState.trackStep?.companyId
        assertExists(companyId, 'A stop’s tokens are bought in the track step')
        await this.session.applyAction(this.createAction(companyId))
    }
}
