import * as Type from 'typebox'
import { Compile } from 'typebox/compile'
import {
    assertExists,
    GameAction,
    HydratableAction,
    MachineContext,
    OffsetCoordinates
} from '@tabletop/common'
import { HydratedSolGameState } from '../model/gameState.js'
import { ActionType } from '../definition/actions.js'
import { Card, Suit } from '../components/cards.js'
import { EffectType } from '../components/effects.js'
import { Station } from '../components/stations.js'
import { HydratedActivate } from './activate.js'

export type DrawCardsMetadata = Type.Static<typeof DrawCardsMetadata>
export const DrawCardsMetadata = Type.Object({
    drawnCards: Type.Array(Card),
    squeezedCards: Type.Array(Card),
    removedStation: Type.Optional(Station),
    energyAdded: Type.Number(),
    createdSundiverIds: Type.Array(Type.String()),
    momentumAdded: Type.Number(),
    coords: Type.Optional(OffsetCoordinates),
    effect: Type.Optional(Type.Enum(EffectType))
})

export type DrawCards = Type.Static<typeof DrawCards>
export const DrawCards = Type.Evaluate(
    Type.Intersect([
        Type.Omit(GameAction, ['playerId', 'revealsInfo']),
        Type.Object({
            type: Type.Literal(ActionType.DrawCards),
            playerId: Type.String(),
            revealsInfo: Type.Literal(true),
            suitGuess: Type.Optional(Type.Enum(Suit)),
            metadata: Type.Optional(DrawCardsMetadata)
        })
    ])
)

export const DrawCardsValidator = Compile(DrawCards)

export function isDrawCards(action?: GameAction): action is DrawCards {
    return action?.type === ActionType.DrawCards
}

export class HydratedDrawCards extends HydratableAction<typeof DrawCards> implements DrawCards {
    declare type: ActionType.DrawCards
    declare playerId: string
    declare revealsInfo: true
    declare suitGuess?: Suit
    declare metadata?: DrawCardsMetadata

    constructor(data: DrawCards) {
        super(data, DrawCardsValidator)
    }

    apply(state: HydratedSolGameState, _context?: MachineContext) {
        if (state.cardsToDraw === undefined || state.cardsToDraw <= 0) {
            throw Error('No cards should be drawn')
        }
        const prng = (state.version ?? 1) > 1 ? state.getPrng() : undefined
        const cards = state.deck.drawItems(Math.min(state.cardsToDraw, state.deck.count()), prng)
        const playerState = state.getPlayerState(this.playerId)
        if (!playerState.drawnCards) {
            playerState.drawnCards = []
        }
        const squeezedCards = structuredClone(playerState.drawnCards)
        playerState.drawnCards.push(...cards)
        this.metadata = {
            drawnCards: cards,
            squeezedCards: squeezedCards,
            energyAdded: 0,
            createdSundiverIds: [],
            momentumAdded: 0
        }
        state.cardsToDraw = 0

        if (state.activeEffect === EffectType.Pillar) {
            const guessedCards = cards.filter((card) => card.suit === this.suitGuess)
            const momentumGained = guessedCards.length * 3
            playerState.momentum += momentumGained
            this.metadata.momentumAdded = momentumGained
            this.metadata.effect = EffectType.Pillar
        }

        if (state.activeEffect === EffectType.Squeeze) {
            this.metadata.effect = EffectType.Squeeze
            const station = state.getActivatingStation(playerState.playerId)
            assertExists(station, 'No station to activate squeeze effect at')
            assertExists(station.coords, 'Station has no coordinates for squeeze effect')

            this.metadata.coords = station.coords
            if (cards.some((card) => card.suit === Suit.Flare)) {
                this.metadata.removedStation = state.board.removeStationAt(station.coords)
                playerState.movement = state.calculatePlayerMovement(playerState.playerId)
            } else {
                // Award the activation again
                const awardMetadata = HydratedActivate.applyActivationAward(playerState, station)
                Object.assign(this.metadata, awardMetadata)
            }
        }

        if (state.activeEffect === EffectType.Channel) {
            const energySpent = cards.length
            playerState.energyCubes -= energySpent
            playerState.momentum += energySpent
            this.metadata.momentumAdded = energySpent
            this.metadata.effect = EffectType.Channel
        }
    }
}
