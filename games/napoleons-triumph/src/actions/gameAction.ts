import type * as Type from 'typebox'
import { HydratableAction } from '@tabletop/common'
import type { HydratedNapoleonsTriumphGameState } from '../model/gameState.js'

export abstract class NapoleonsTriumphAction<
    Schema extends Type.TSchema
> extends HydratableAction<Schema> {
    declare playerId: string

    protected abstract perform(state: HydratedNapoleonsTriumphGameState): void

    /** Rule 7: an action that shows its player an enemy block it could not see is not taken back. */
    apply(state: HydratedNapoleonsTriumphGameState) {
        const hidden = state.unitsHiddenFrom(this.playerId).map((unit) => unit.id)
        this.perform(state)
        if (hidden.some((id) => state.findUnit(id)?.shown !== undefined || !state.findUnit(id))) {
            this.revealsInfo = true
        }
    }
}
