import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { RaidResult } from '../components/combatTables.js'
import type { TechField } from '../components/techFields.js'
import type { TradeGood } from '../components/tradeGoods.js'
import { ActionType } from '../definition/actions.js'
import { drewMarkers } from '../model/fleet.js'
import { RaidOutcome } from '../model/pieces.js'
import { RaidChoice, isValidRaidChoice, resolveRaid } from '../model/raids.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ResolveRaid = Type.Static<typeof ResolveRaid>
export const ResolveRaid = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        RaidChoice,
        Type.Object({
            type: Type.Literal(ActionType.ResolveRaid),
            playerId: Type.String(),
            metadata: Type.Optional(RaidOutcome)
        })
    ])
)

export const ResolveRaidValidator = Compile(ResolveRaid)

export function isResolveRaid(action?: GameAction): action is ResolveRaid {
    return action?.type === ActionType.ResolveRaid
}

// The raider's choice of result (the Syndicate may lower it), marker type or good.
export class HydratedResolveRaid
    extends HydratableAction<typeof ResolveRaid>
    implements ResolveRaid
{
    declare type: ActionType.ResolveRaid
    declare playerId: string
    declare result: RaidResult
    declare field?: TechField
    declare good?: TradeGood
    declare stolen?: boolean
    declare metadata?: RaidOutcome

    constructor(data: ResolveRaid) {
        super(data, ResolveRaidValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const choice = {
            result: this.result,
            ...(this.field !== undefined ? { field: this.field } : {}),
            ...(this.good !== undefined ? { good: this.good } : {}),
            ...(this.stolen !== undefined ? { stolen: this.stolen } : {})
        }
        if (
            state.combat?.attackerId !== this.playerId ||
            state.combat.raidOutcome !== undefined ||
            !isValidRaidChoice(state, choice)
        ) {
            throw Error('Invalid ResolveRaid action')
        }
        this.metadata = resolveRaid(state, choice)
        this.revealsInfo = this.metadata.marker !== undefined || drewMarkers(this.metadata.lost)
    }
}
