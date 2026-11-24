import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { ActionSource, GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { GuildRefill, refillGuilds } from '../model/guildRefill.js'

export type ReplenishGuilds = Type.Static<typeof ReplenishGuilds>
export const ReplenishGuilds = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['source', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.ReplenishGuilds),
            source: Type.Literal(ActionSource.System),
            revealsInfo: Type.Literal(true),
            metadata: Type.Optional(GuildRefill)
        })
    ])
)

export const ReplenishGuildsValidator = Compile(ReplenishGuilds)

export function isReplenishGuilds(action?: GameAction): action is ReplenishGuilds {
    return action?.type === ActionType.ReplenishGuilds
}

export class HydratedReplenishGuilds
    extends HydratableAction<typeof ReplenishGuilds>
    implements ReplenishGuilds
{
    declare type: ActionType.ReplenishGuilds
    declare source: ActionSource.System
    declare revealsInfo: true
    declare metadata?: GuildRefill

    constructor(data: ReplenishGuilds) {
        super(data, ReplenishGuildsValidator)
    }

    /** R-4.12.5, R-X.2 Haversack draws and bead flips: always a barrier. */
    apply(state: HydratedFeudumGameState, _context?: MachineContext) {
        // Read the vault first: a projected state defers before any public change.
        state.requireVault()
        this.metadata = refillGuilds(state)
    }
}
