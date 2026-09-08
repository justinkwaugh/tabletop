import { Equal } from 'typebox/value'
import { assert, assertExists, shuffle, type ExplorationPopulation } from '@tabletop/common'
import { ActionCardDeck, CardBack } from '../definition/actionCards.js'
import { isDrawActionCard } from '../actions/drawActionCard.js'
import { isLookAtPoliticsPile } from '../actions/lookAtPoliticsPile.js'
import { isTakePoliticsCard } from '../actions/takePoliticsCard.js'
import { PoliticsCardType } from '../definition/politicsCards.js'
import {
    LowenherzGameStateValidator,
    type LowenherzGameState,
    type LowenherzProjectedState
} from '../model/gameState.js'
import { populatePoliticsCards } from './politicsExploration.js'

export function populateLowenherzExploration({
    game,
    state,
    actions,
    perspective,
    random
}: ExplorationPopulation<LowenherzProjectedState>): LowenherzGameState {
    assert(
        state.privateInformation,
        'This game predates the observations required for private Exploration'
    )
    assert(
        actions.length === state.actionCount &&
            actions.every((action, index) => action.index === index),
        'Exploration requires complete permitted history through the source position'
    )
    for (const action of actions) {
        if (perspective.kind !== 'player' || action.playerId !== perspective.playerId) continue
        if (isLookAtPoliticsPile(action))
            assertExists(
                action.metadata?.cards,
                'Exploration requires your prior inspection records'
            )
        if (isTakePoliticsCard(action))
            assertExists(action.card, 'Exploration requires your prior card choices')
    }
    const { hands, politicsCardPileA, politicsCardPileB } = populatePoliticsCards(
        state,
        actions,
        random
    )
    const usesConstruction = game.players.length === 2 || game.config.playerPlacedCastles !== false
    const remaining = ActionCardDeck.filter((card) => usesConstruction || card.back !== CardBack.A)
    for (const action of actions) {
        if (!isDrawActionCard(action)) continue
        const card = action.metadata?.card
        assertExists(card, 'Exploration requires complete revealed action cards')
        const index = remaining.findIndex(
            (candidate) => candidate.id === card.id && Equal(candidate, card)
        )
        assert(index >= 0, 'Revealed action cards disagree with the configured deck')
        remaining.splice(index, 1)
    }
    const actionDeck = Object.values(CardBack).flatMap((back) => {
        const group = remaining.filter((card) => card.back === back)
        shuffle(group, random)
        return group
    })
    assert(
        Equal(
            actionDeck.map((card) => card.back),
            state.actionDeckBacks
        ),
        'Exploration action deck counts disagree with revealed history'
    )
    const result = {
        ...structuredClone(state),
        actionDeck,
        politicsCardPileA,
        politicsCardPileB,
        players: state.players.map((player) => {
            const politicsCards = hands.get(player.playerId)
            assertExists(politicsCards, 'Exploration hand was not populated')
            return {
                ...structuredClone(player),
                politicsCards,
                ...(state.openedPoliticsPile && state.politicsTakingPlayerId === player.playerId
                    ? {
                          politicsInspection: {
                              pile: state.openedPoliticsPile,
                              cards: structuredClone(
                                  state.openedPoliticsPile === 'A'
                                      ? politicsCardPileA
                                      : politicsCardPileB
                              )
                          }
                      }
                    : {})
            }
        }),
        ...(state.duel
            ? {
                  duel: {
                      ...structuredClone(state.duel),
                      bids: state.duel.bids.map((bid) => {
                          const player = state.players.find(
                              (player) => player.playerId === bid.playerId
                          )
                          assertExists(player, 'Unknown duel bidder')
                          const hand = hands.get(bid.playerId)
                          assertExists(hand, 'Exploration bidder hand was not populated')
                          const treasureValues =
                              bid.amount !== undefined
                                  ? (bid.treasureValues ?? [])
                                  : hand
                                        .filter(
                                            (card) =>
                                                card.type === PoliticsCardType.Treasure &&
                                                random() < 0.5
                                        )
                                        .map((card) => {
                                            assertExists(card.value, 'Treasure value is missing')
                                            return card.value
                                        })
                          return {
                              ...bid,
                              amount: bid.amount ?? Math.floor(random() * (player.money + 1)),
                              treasureValues
                          }
                      })
                  }
              }
            : {})
    }
    assert(
        LowenherzGameStateValidator.Check(result),
        'Exploration did not produce complete canonical state'
    )
    return result
}
