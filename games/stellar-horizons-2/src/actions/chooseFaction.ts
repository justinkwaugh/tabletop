import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { Faction, factionDefinition } from '../components/factions.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'

export type ChooseFaction = Type.Static<typeof ChooseFaction>
export const ChooseFaction = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.ChooseFaction),
            playerId: Type.String(),
            faction: Type.Enum(Faction)
        })
    ])
)

export const ChooseFactionValidator = Compile(ChooseFaction)

export function isChooseFaction(action?: GameAction): action is ChooseFaction {
    return action?.type === ActionType.ChooseFaction
}

export class HydratedChooseFaction
    extends HydratableAction<typeof ChooseFaction>
    implements ChooseFaction
{
    declare type: ActionType.ChooseFaction
    declare playerId: string
    declare faction: Faction

    constructor(data: ChooseFaction) {
        super(data, ChooseFactionValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        if (!HydratedChooseFaction.availableFactions(state).includes(this.faction)) {
            throw Error('Invalid ChooseFaction action')
        }
        const player = state.getPlayerState(this.playerId)
        const color = factionDefinition(this.faction).color
        const holder = state.players.find(
            (other) => other.playerId !== this.playerId && other.color === color
        )
        if (holder) {
            holder.color = player.color
        }
        player.color = color
        player.faction = this.faction
    }

    static availableFactions(state: HydratedStellarHorizonsGameState): Faction[] {
        const chosen = state.players.flatMap((player) => (player.faction ? [player.faction] : []))
        return Object.values(Faction).filter((faction) => !chosen.includes(faction))
    }
}
