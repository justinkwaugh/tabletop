import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { TechId, techDefinition } from '../components/techs.js'
import {
    canDevelopAnyTech,
    isFirstToDevelop,
    isTechAvailable,
    isValidPayment,
    removeMarkers,
    techCost
} from '../model/development.js'
import { gainInfluence, isCampaign } from '../model/campaign.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { holdSpentMarkers } from '../model/settlement.js'

export const FIRST_TO_DEVELOP_INFLUENCE = 1

export type DevelopTechMetadata = Type.Static<typeof DevelopTechMetadata>
export const DevelopTechMetadata = Type.Object({
    cost: Type.Number(),
    first: Type.Optional(Type.Boolean())
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
            influence: Type.Optional(Type.Number()),
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
    declare influence?: number
    declare metadata?: DevelopTechMetadata

    constructor(data: DevelopTech) {
        super(data, DevelopTechValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        if (
            !isTechAvailable(state, this.playerId, this.techId) ||
            !isValidPayment(
                state,
                this.playerId,
                { techId: this.techId },
                this.markers,
                this.cash,
                this.influence
            )
        ) {
            throw Error('Invalid DevelopTech action')
        }
        const field = techDefinition(this.techId).field
        const cost = techCost(state, this.playerId, this.techId)
        removeMarkers(player.techMarkers[field], this.markers)
        holdSpentMarkers(state, this.playerId, field, this.markers)
        player.cash -= this.cash
        player.influence -= this.influence ?? 0
        const first = isCampaign(state) && isFirstToDevelop(state, this.techId)
        player.techs.push({ techId: this.techId, year: state.year })
        player.fieldsDeveloped.push(field)
        player.breakthroughs = player.breakthroughs.filter((candidate) => candidate !== field)
        gainInfluence(state, this.playerId, first ? FIRST_TO_DEVELOP_INFLUENCE : 0)
        this.metadata = first ? { cost, first } : { cost }
    }

    static canDevelopTech(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return canDevelopAnyTech(state, playerId)
    }
}
