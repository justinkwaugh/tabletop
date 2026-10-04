import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { TECHS, TechId, techDefinition } from '../components/techs.js'
import {
    canAffordTech,
    isTechAvailable,
    isValidTechPayment,
    removeMarkers,
    techCost
} from '../model/development.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { returnTechMarkers } from '../model/pools.js'
import { TurnStep } from '../model/turn.js'

export type DevelopTechMetadata = Type.Static<typeof DevelopTechMetadata>
export const DevelopTechMetadata = Type.Object({
    cost: Type.Number()
})

export type DevelopTech = Type.Static<typeof DevelopTech>
export const DevelopTech = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DevelopTech),
            playerId: Type.String(),
            techId: Type.Enum(TechId),
            markers: Type.Array(Type.Number()),
            cash: Type.Number(),
            metadata: Type.Optional(DevelopTechMetadata)
        })
    ])
)

export const DevelopTechValidator = Compile(DevelopTech)

export function isDevelopTech(action?: GameAction): action is DevelopTech {
    return action?.type === ActionType.DevelopTech
}

export class HydratedDevelopTech
    extends HydratableAction<typeof DevelopTech>
    implements DevelopTech
{
    declare type: ActionType.DevelopTech
    declare playerId: string
    declare techId: TechId
    declare markers: number[]
    declare cash: number
    declare metadata?: DevelopTechMetadata

    constructor(data: DevelopTech) {
        super(data, DevelopTechValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            player.step !== TurnStep.Development ||
            !isTechAvailable(state, this.playerId, this.techId) ||
            !isValidTechPayment(state, this.playerId, this.techId, this.markers, this.cash)
        ) {
            throw Error('Invalid DevelopTech action')
        }
        const field = techDefinition(this.techId).field
        const cost = techCost(state, this.playerId, this.techId)
        removeMarkers(player.techMarkers[field], this.markers)
        returnTechMarkers(state, field, this.markers)
        player.cash -= this.cash
        player.techs.push({ techId: this.techId, year: state.year })
        player.fieldsDeveloped.push(field)
        this.metadata = { cost }
    }

    static canDevelopTech(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return (
            state.getPlayerState(playerId).step === TurnStep.Development &&
            TECHS.some(
                (definition) =>
                    isTechAvailable(state, playerId, definition.id) &&
                    canAffordTech(state, playerId, definition.id)
            )
        )
    }
}
