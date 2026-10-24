import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import { GameAction, HydratableAction, MachineContext, Visibility } from '@tabletop/common'
import { CardDeck, type CardLevel } from '../components/cards.js'
import { ActionType } from '../definition/actions.js'
import { drawCard, drawableLevels, giveUpCardDraw, nextCardDrawer } from '../model/cards.js'
import type { HydratedStellarHorizonsGameState } from '../model/gameState.js'
import { CardLevelValue } from '../model/pieces.js'

// The card drawn, which only the drawer sees; everyone sees the deck and level it came from and
// whether it was kept.
export type DrawnCard = Type.Static<typeof DrawnCard>
export const DrawnCard = Type.Object({
    playerId: Type.String(),
    cardId: Visibility.protect(Type.String(), { policy: Visibility.Policy.Owner })
})

export type DrawCardMetadata = Type.Static<typeof DrawCardMetadata>
export const DrawCardMetadata = Type.Object({
    drawn: Type.Optional(DrawnCard),
    kept: Type.Boolean()
})

// Rulebook 1.20: one card for the drawer's next owed draw, from a level of the drawer's choice
// among those their techs allow (campaign plan, slice 4, Q3). With one level to draw from it is
// drawn for them; with none the draw is given up. A copy of a card they hold or own is discarded
// and they draw again.
export type DrawCard = Type.Static<typeof DrawCard>
export const DrawCard = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId']),
        Type.Object({
            type: Type.Literal(ActionType.DrawCard),
            playerId: Type.String(),
            deck: Type.Enum(CardDeck),
            level: Type.Optional(CardLevelValue),
            metadata: Type.Optional(DrawCardMetadata)
        })
    ])
)

export const DrawCardValidator = Compile(DrawCard)

export function isDrawCard(action?: GameAction): action is DrawCard {
    return action?.type === ActionType.DrawCard
}

export class HydratedDrawCard extends HydratableAction<typeof DrawCard> implements DrawCard {
    declare type: ActionType.DrawCard
    declare playerId: string
    declare deck: CardDeck
    declare level?: CardLevel
    declare metadata?: DrawCardMetadata

    constructor(data: DrawCard) {
        super(data, DrawCardValidator)
    }

    apply(state: HydratedStellarHorizonsGameState, _context?: MachineContext) {
        const player = state.getPlayerState(this.playerId)
        const levels = drawableLevels(state, this.playerId, this.deck)
        if (
            nextCardDrawer(state) !== this.playerId ||
            player.cardDraws[0] !== this.deck ||
            (this.level === undefined ? levels.length > 0 : !levels.includes(this.level))
        ) {
            throw Error('Invalid DrawCard action')
        }
        if (this.level === undefined) {
            giveUpCardDraw(state, this.playerId, this.deck)
            this.metadata = { kept: false }
            return
        }
        const { cardId, kept } = drawCard(state, this.playerId, this.deck, this.level)
        this.metadata = { drawn: { playerId: this.playerId, cardId }, kept }
        this.revealsInfo = true
    }
}
