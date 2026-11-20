import { Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { FeudumGameConfig } from '../definition/config.js'
import { FeudumHydrator } from '../definition/hydrator.js'
import { MachineState } from '../definition/states.js'
import { FeudumGameState } from '../model/gameState.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import {
    cardPlayOffers,
    reasonCardPlayRefused,
    reasonNotLastRefused,
    reasonSpecialRefused,
    specialOffered
} from './cardPlay.js'
import { ForfeitCard, HydratedForfeitCard, reasonForfeitRefused } from './forfeitCard.js'
import { HydratedPlayDefend, PlayDefend, reasonPlayDefendRefused } from './playDefend.js'
import { cardTurnSeat } from '../model/turns.js'

const HAND: ActionCardKind[] = ['move', 'tax', 'defend', 'conquer']
const HAND_ORDER: ActionCardKind[] = ['move', 'tax', 'defend']
const NO_SULFUR_ON_POUCH = 'You have no sulfur on your pouch.'

function forfeit(table: Table, playerId: string, kind: ActionCardKind, secondCard?: true) {
    return table.send(playerId, {
        type: ActionType.ForfeitCard,
        kind,
        ...(secondCard ? { secondCard } : {})
    })
}

function allHolding(cards: ActionCardKind[], numPlayers = 4): Table {
    return tableAtPlayingCards(() => ({ cards }), numPlayers)
}

describe('ForfeitCard', () => {
    it('R-3.2 takes the card from the hand into played, without its action, and passes on', () => {
        const table = allHolding(HAND)
        const [first, second] = table.order
        const before = table.seat(first)

        const [action] = forfeit(table, first, 'move')

        const after = table.seat(first)
        expect(after.hand).toEqual(['tax', 'defend', 'conquer'])
        expect(after.handCount).toBe(3)
        expect(after.played).toEqual([{ kind: 'move', use: 'forfeited' }])
        // Nothing else the card could do has happened.
        expect(after.score).toBe(before.score)
        expect(after.pawns).toEqual(before.pawns)
        expect(after.shillings).toBe(before.shillings)
        expect(after.goods).toEqual(before.goods)
        expect(action.revealsInfo).toBeFalsy()
        expect(action).not.toHaveProperty('metadata')

        // R-3.2 One card at a time, clockwise.
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(second)
        expect(cardTurnSeat(table.hydrated())).toBe(second)
        expect(table.state.flow.turn).toEqual({ secondCard: false, followUps: [] })
    })

    it('R-3.2 plays any card in the hand, and refuses one that is not, with the reason', () => {
        const table = allHolding(HAND)
        const [first] = table.order
        expect(() => forfeit(table, first, 'guild')).toThrow("Guild isn't in your hand.")
        for (const kind of HAND) {
            expect(reasonForfeitRefused(table.hydrated(), first, kind, {})).toBeUndefined()
        }
    })

    it('R-3.2 refuses a seat out of turn, whoever is active', () => {
        const table = allHolding(HAND)
        const [, second] = table.order
        expect(reasonForfeitRefused(table.hydrated(), second, 'move', {})).toBe(
            "It isn't your turn."
        )
    })

    it('R-3.13-H1 is the one way to play a last Conquer (S11)', () => {
        const table = allHolding(['conquer', 'tax'], 2)
        const [first, second] = table.order
        forfeit(table, first, 'tax')
        forfeit(table, second, 'tax')

        expect(reasonCardPlayRefused(table.hydrated(), first, 'conquer', {})).toBe(
            "Conquer can't be your last card: forfeit it."
        )
        expect(reasonForfeitRefused(table.hydrated(), first, 'conquer', {})).toBeUndefined()

        forfeit(table, first, 'conquer')
        expect(table.seat(first).played.at(-1)).toEqual({ kind: 'conquer', use: 'forfeited' })
    })

    it('is registered in the API schemas and the hydrator', () => {
        expect(FeudumApiActions[ActionType.ForfeitCard]).toBe(ForfeitCard)
        const table = allHolding(HAND)
        const [action] = forfeit(table, table.order[0], 'move')
        expect(new FeudumHydrator().hydrateAction(action)).toBeInstanceOf(HydratedForfeitCard)
    })
})

describe('PlayDefend', () => {
    it('R-3.14.1 in turn scores 1 vp and gives no defence (S24)', () => {
        const table = allHolding(HAND)
        const [first, second] = table.order

        const [action] = table.send(first, { type: ActionType.PlayDefend })

        const after = table.seat(first)
        expect(after.score).toBe(1)
        expect(after.hand).toEqual(['move', 'tax', 'conquer'])
        expect(after.handCount).toBe(3)
        expect(after.played).toEqual([{ kind: 'defend', use: 'regular' }])
        expect(action).toMatchObject({ metadata: { vp: 1 } })
        expect(action.revealsInfo).toBeFalsy()
        expect(table.state.flow.combat).toBeUndefined()
        expect(table.asked).toBe(second)
    })

    it('R-3.14.1 is offered and accepted only with Defend in the hand', () => {
        const table = allHolding(['move', 'tax', 'guild', 'explore'])
        const [first] = table.order
        expect(table.offered(first)).not.toContain(ActionType.PlayDefend)
        expect(() => table.send(first, { type: ActionType.PlayDefend })).toThrow(
            "Defend isn't in your hand."
        )
        expect(reasonPlayDefendRefused(table.hydrated(), first, {})).toBe(
            "Defend isn't in your hand."
        )
    })

    it('R-3.2 only the turn player is offered a card play', () => {
        const table = allHolding(HAND)
        const [first, second] = table.order
        expect(table.offered(first)).toContain(ActionType.PlayDefend)
        expect(table.offered(second)).toEqual([])
    })

    it('R-3.15 can never be replayed, with the reason', () => {
        const table = allHolding(['repeat', 'defend', 'move', 'tax'], 2)
        const [first, second] = table.order
        table.send(first, { type: ActionType.PlayDefend })
        forfeit(table, second, 'move')
        expect(() =>
            table.send(first, { type: ActionType.PlayDefend, asRepeat: 'deja-vu' })
        ).toThrow("Defend can't be replayed.")
    })

    it('is registered in the API schemas and the hydrator', () => {
        expect(FeudumApiActions[ActionType.PlayDefend]).toBe(PlayDefend)
        const table = allHolding(HAND)
        const [action] = table.send(table.order[0], { type: ActionType.PlayDefend })
        expect(new FeudumHydrator().hydrateAction(action)).toBeInstanceOf(HydratedPlayDefend)
    })
})

describe('R-3.3, R-3.3-H1 the sequential turn', () => {
    const withSulfur = () =>
        tableAtPlayingCards((playerId) => ({
            cards: ['move', 'tax', 'defend', 'guild'],
            ...(playerId === 'p1' ? { pouchGood: 'sulfur' as const } : {})
        }))

    /** The table moved on until p1 is asked. */
    function untilP1(table: Table) {
        while (table.asked !== 'p1') {
            forfeit(table, table.asked, 'guild')
        }
    }

    it('secondCard declares it with the first card: the same seat plays again, then it passes', () => {
        const table = withSulfur()
        untilP1(table)

        const [action] = forfeit(table, 'p1', 'move', true)
        expect(action.revealsInfo).toBeFalsy()
        expect(table.asked).toBe('p1')
        expect(cardTurnSeat(table.hydrated())).toBe('p1')
        expect(table.state.flow.turn).toEqual({ secondCard: true, followUps: [] })
        expect(table.seat('p1').sequentialUsed).toBe(true)

        table.send('p1', { type: ActionType.PlayDefend })
        expect(table.asked).not.toBe('p1')
        expect(table.seat('p1').played.map((card) => card.kind)).toEqual(['move', 'defend'])
        expect(table.seat('p1').pouch).toBe('sulfur')
    })

    it('refuses it with no pouch sulfur, whatever else the seat holds, with the reason', () => {
        const table = allHolding(HAND)
        const [first] = table.order
        expect(() => forfeit(table, first, 'move', true)).toThrow(NO_SULFUR_ON_POUCH)

        const saltpeter = tableAtPlayingCards(() => ({
            cards: ['move', 'tax', 'defend', 'guild', 'explore'],
            pouchGood: 'saltpeter'
        }))
        expect(() => forfeit(saltpeter, saltpeter.order[0], 'move', true)).toThrow(
            NO_SULFUR_ON_POUCH
        )
    })

    it('refuses a second declaration in the round, with the reason', () => {
        const table = withSulfur()
        untilP1(table)
        forfeit(table, 'p1', 'move', true)
        expect(() => forfeit(table, 'p1', 'tax', true)).toThrow(
            'You have already played your sequential turn.'
        )
    })

    it('refuses it on the last card: there is no second card to play', () => {
        const table = tableAtPlayingCards(() => ({
            cards: ['move', 'tax', 'defend', 'guild'],
            pouchGood: 'sulfur'
        }))
        for (let round = 0; round < 3; round += 1) {
            for (const playerId of table.order) {
                forfeit(table, playerId, HAND_ORDER[round])
            }
        }
        expect(() => forfeit(table, table.order[0], 'guild', true)).toThrow(
            'You have no second card to play.'
        )
    })

    it('R-3.13-H1 the second card keeps a first Conquer from being last', () => {
        const table = tableAtPlayingCards(() => ({
            cards: ['conquer', 'tax', 'guild', 'move'],
            pouchGood: 'sulfur'
        }))
        for (const kind of ['guild', 'move'] as const) {
            for (const playerId of table.order) {
                forfeit(table, playerId, kind)
            }
        }
        expect(
            reasonCardPlayRefused(table.hydrated(), table.order[0], 'conquer', { secondCard: true })
        ).toBeUndefined()
    })
})

describe('R-3.2-H1 a seat with no cards is skipped', () => {
    it('the seat with an extra card keeps playing after the others run out', () => {
        const table = tableAtPlayingCards((playerId) =>
            playerId === 'p2'
                ? { cards: ['move', 'tax', 'guild', 'explore', 'harvest'], pouchGood: 'saltpeter' }
                : { cards: ['move', 'tax', 'guild', 'explore'] }
        )
        for (const kind of ['move', 'tax', 'guild', 'explore'] as const) {
            for (const playerId of table.order) {
                forfeit(table, playerId, kind)
            }
        }
        expect(table.asked).toBe('p2')
        expect(cardTurnSeat(table.hydrated())).toBe('p2')
    })

    it('once every card is played the turn closes and the round moves on', () => {
        const table = allHolding(['move', 'tax'], 2)
        for (const kind of ['move', 'tax'] as const) {
            for (const playerId of table.order) {
                forfeit(table, playerId, kind)
            }
        }
        expect(table.state.machineState).not.toBe(MachineState.PlayingCards)
        expect(table.state.flow.turn).toBeUndefined()
        expect(table.hydrated().turnManager.currentTurn()).toBeUndefined()
    })
})

describe('R-3.4, R-3.5 a special is offered only when its need is met', () => {
    function firstSeat() {
        const table = allHolding(['move', 'influence', 'improve', 'guild'])
        const state = table.hydrated()
        const playerId = table.order[0]
        return { state, playerId, player: state.getPlayerState(playerId) }
    }

    it('R-3.4 a pawn on the board, by its character', () => {
        const { state, playerId, player } = firstSeat()
        expect(reasonSpecialRefused(state, playerId, 'move')).toBe(
            'Godspeed needs a Monk pawn on the board.'
        )
        expect(reasonSpecialRefused(state, playerId, 'migrate')).toBe(
            'Distant Kin needs an Alchemist pawn on the board.'
        )
        // tableAtPlayingCards stands a Farmer pawn on the board.
        expect(specialOffered(state, playerId, 'harvest')).toBe(true)

        player.pawns[1] = { n: 2, spaceId: 'space.desert.3', character: 'monk' }
        expect(specialOffered(state, playerId, 'move')).toBe(true)
    })

    it('R-3.5 a pawn at the location, where the card shows one', () => {
        const { state, playerId, player } = firstSeat()
        expect(reasonSpecialRefused(state, playerId, 'conquer', 'space.desert.3')).toBe(
            'Starve the People needs a Noble pawn at the location.'
        )
        player.pawns[1] = { n: 2, spaceId: 'space.desert.2', character: 'noble' }
        // Somewhere on the board is enough to offer it; the space then has to match.
        expect(specialOffered(state, playerId, 'conquer')).toBe(true)
        expect(specialOffered(state, playerId, 'conquer', 'space.desert.3')).toBe(false)
        expect(specialOffered(state, playerId, 'conquer', 'space.desert.2')).toBe(true)
    })

    it('R-3.4 a good, a barrel sulfur or shillings to turn in', () => {
        const { state, playerId, player } = firstSeat()
        expect(reasonSpecialRefused(state, playerId, 'improve')).toBe(
            'Tend Landscape needs a wood.'
        )
        player.goods.wood = 1
        expect(specialOffered(state, playerId, 'improve')).toBe(true)

        // The default starting goods hold sulfur in the supply and nothing in the barrel.
        expect(reasonSpecialRefused(state, playerId, 'guild')).toBe(
            'Feast needs a sulfur in your barrel.'
        )
        player.barrel = 1
        expect(specialOffered(state, playerId, 'guild')).toBe(true)

        player.pawns[1] = { n: 2, spaceId: 'space.desert.3', character: 'merchant' }
        player.shillings = 0
        expect(reasonSpecialRefused(state, playerId, 'influence', 'space.desert.3')).toBe(
            'Money is Influence needs 1 shilling.'
        )
        player.shillings = 1
        expect(specialOffered(state, playerId, 'influence', 'space.desert.3')).toBe(true)
    })

    it('R-3.4-H1 the advanced rules always: no table option, and the offers read no config', () => {
        expect(Object.keys(FeudumGameConfig.properties)).toEqual([])
        const { state, playerId, player } = firstSeat()
        player.pawns[1] = { n: 2, spaceId: 'space.desert.3', character: 'monk' }
        const move = cardPlayOffers(state, playerId).cards.find((card) => card.kind === 'move')
        expect(move?.special).toBe(true)
    })

    it('R-3.14.2 Royal Immunity is never offered in turn, food or not', () => {
        const table = allHolding(HAND)
        const state = table.hydrated()
        const playerId = table.order[0]
        state.getPlayerState(playerId).goods.food = 1
        const defend = cardPlayOffers(state, playerId).cards.find((card) => card.kind === 'defend')
        expect(defend?.special).toBe(false)
    })
})

describe('R-3.13-H1 the not-last helper', () => {
    it('refuses Conquer only as the last card, and marks it forfeit-only (S11)', () => {
        const table = allHolding(['conquer', 'tax'], 2)
        const [first, second] = table.order
        expect(reasonNotLastRefused(table.hydrated(), first, 'conquer')).toBeUndefined()
        expect(reasonNotLastRefused(table.hydrated(), first, 'tax')).toBeUndefined()
        expect(cardPlayOffers(table.hydrated(), first).cards).toMatchObject([
            { kind: 'conquer', forfeitOnly: false },
            { kind: 'tax', forfeitOnly: false }
        ])

        forfeit(table, first, 'tax')
        forfeit(table, second, 'tax')

        expect(reasonNotLastRefused(table.hydrated(), first, 'conquer')).toBe(
            "Conquer can't be your last card: forfeit it."
        )
        expect(cardPlayOffers(table.hydrated(), first).cards).toMatchObject([
            { kind: 'conquer', forfeitOnly: true }
        ])
    })

    it('leaves the other cards alone as a last card', () => {
        const table = allHolding(['tax'], 2)
        const [first] = table.order
        expect(reasonNotLastRefused(table.hydrated(), first, 'tax')).toBeUndefined()
        expect(reasonCardPlayRefused(table.hydrated(), first, 'tax', {})).toBeUndefined()
    })
})

describe('R-5.1 a played card is public; the hand stays owner-known', () => {
    const projector = Visibility.createProjector(FeudumGameState)

    it('the table sees the played card and the count, not the hand', () => {
        const table = allHolding(HAND)
        const [first, second] = table.order
        forfeit(table, first, 'move')
        const seen = projector.project(
            canonicalOf(table.hydrated()),
            { kind: 'player', playerId: second },
            { config: {} }
        )
        const row = seen.players.find((player) => player.playerId === first)
        expect(row?.played).toEqual([{ kind: 'move', use: 'forfeited' }])
        expect(row?.handCount).toBe(3)
        expect(row?.hand).toBeUndefined()
    })
})
