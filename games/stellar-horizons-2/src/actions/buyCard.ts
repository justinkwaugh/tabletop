import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext } from '@tabletop/common'
import { cardDefinition } from '../components/cards.js'
import { ActionType } from '../definition/actions.js'
import {
    canBuyAnyCard,
    isPurchaseAvailable,
    isValidPayment,
    purchaseCost,
    removeMarkers
} from '../model/development.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { holdSpentMarkers } from '../model/settlement.js'

export type BuyCardMetadata = Type.Static<typeof BuyCardMetadata>
export const BuyCardMetadata = Type.Object({
    cost: Type.Number()
})

// Rulebook 1.20: a card from the Player's own hand, paid like a tech, goes face up in front of
// them. It stays in the development Branch, since the hand is the Player's own.
export type BuyCard = Type.Static<typeof BuyCard>
export const BuyCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.BuyCard),
            playerId: Type.String(),
            cardId: Type.String(),
            markers: Type.Array(Type.Number()),
            cash: Type.Number(),
            influence: Type.Optional(Type.Number()),
            metadata: Type.Optional(BuyCardMetadata)
        })
    ])
)

export const BuyCardValidator = Compile(BuyCard)

export function isBuyCard(action?: GameAction): action is BuyCard {
    return action?.type === ActionType.BuyCard
}

export class HydratedBuyCard extends HydratableAction<typeof BuyCard> implements BuyCard {
    declare type: ActionType.BuyCard
    declare playerId: string
    declare cardId: string
    declare markers: number[]
    declare cash: number
    declare influence?: number
    declare metadata?: BuyCardMetadata

    constructor(data: BuyCard) {
        super(data, BuyCardValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const purchase = { cardId: this.cardId }
        if (
            !isPurchaseAvailable(state, this.playerId, purchase) ||
            !isValidPayment(state, this.playerId, purchase, this.markers, this.cash, this.influence)
        ) {
            throw Error('Invalid BuyCard action')
        }
        const player = state.getPlayerState(this.playerId)
        const field = cardDefinition(this.cardId).field
        const cost = purchaseCost(state, this.playerId, purchase)
        removeMarkers(player.techMarkers[field], this.markers)
        holdSpentMarkers(state, this.playerId, field, this.markers)
        player.cash -= this.cash
        player.influence -= this.influence ?? 0
        player.hand = player.hand.filter((card) => card.cardId !== this.cardId)
        player.cards.push({ cardId: this.cardId, year: state.year, bought: true })
        player.fieldsDeveloped.push(field)
        this.metadata = { cost }
    }

    static canBuyCard(state: HydratedStellarHorizonsGameState, playerId: string): boolean {
        return canBuyAnyCard(state, playerId)
    }
}
