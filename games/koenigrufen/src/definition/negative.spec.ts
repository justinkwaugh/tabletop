import { assert, type Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isEndHand } from '../actions/endHand.js'
import { isPlayCard } from '../actions/playCard.js'
import { cardPoints, Deck, trumpId } from '../components/cards.js'
import { Contract } from '../components/contracts.js'
import { KoenigrufenGameStateValidator } from '../model/gameState.js'
import {
    declareByMeinSpiel,
    passAnnouncements,
    playOutHand,
    setHands,
    startTestGame,
    type TestSession
} from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { KoenigrufenRuntime } from './runtime.js'
import { MachineState } from './states.js'

function lastHandResult(session: TestSession) {
    return session.actions.findLast(isEndHand)?.metadata
}

function project(session: TestSession, perspective: Visibility.Perspective) {
    assert(KoenigrufenGameStateValidator.Check(session.state), 'The test game is canonical')
    return KoenigrufenRuntime.visibility.state.project(session.state, perspective, {
        config: session.game.config
    })
}

const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, index) => trumpId(from + index))

// Forehand holds trumps XI–Sküs and so wins every trick it leads; the next player holds II–X.
function forehandTakesEverything(session: TestSession) {
    const [p0, p1, p2, p3] = session.hydrated().seats()
    const suitCards = Deck.filter((card) => card.kind === 'suit').map((card) => card.id)
    setHands(
        session,
        {
            [p0]: range(11, 22),
            [p1]: [...range(2, 10), ...suitCards.slice(0, 3)],
            [p2]: suitCards.slice(3, 15),
            [p3]: suitCards.slice(15, 27)
        },
        [trumpId(1), ...suitCards.slice(27)]
    )
    return [p0, p1, p2, p3] as const
}

function play(session: TestSession, cardId?: string) {
    const playerId = session.activePlayerId()
    const [first] = session.hydrated().legalPlays(playerId)
    session.act(playerId, ActionType.PlayCard, { cardId: cardId ?? first })
}

describe('negative games', () => {
    it('let declarer lead, and stop the Bettel at declarer’s first trick', () => {
        const session = startTestGame()
        const [p0, p1, p2, p3] = forehandTakesEverything(session)
        declareByMeinSpiel(session, Contract.Bettel)
        expect(session.state.machineState).toBe(MachineState.Announcing)
        passAnnouncements(session)
        expect(session.activePlayerId()).toBe(p0)
        play(session, trumpId(22))
        for (let index = 0; index < 3; index++) {
            play(session)
        }
        const result = lastHandResult(session)
        expect(result?.declarerTricks).toBe(1)
        expect(result?.made).toBe(false)
        expect(result?.scoreChanges).toEqual({ [p0]: -6, [p1]: 2, [p2]: 2, [p3]: 2 })
        expect(result?.talon).toHaveLength(6)
        expect(session.state.machineState).toBe(MachineState.Bidding)
    })

    it('stop the Piccolo at declarer’s second trick', () => {
        const session = startTestGame()
        forehandTakesEverything(session)
        declareByMeinSpiel(session, Contract.Piccolo)
        passAnnouncements(session)
        for (let index = 0; index < 8; index++) {
            play(session)
        }
        const result = lastHandResult(session)
        expect(result?.declarerTricks).toBe(2)
        expect(result?.made).toBe(false)
    })
})

describe('ouvert games', () => {
    it('lay every hand open once a card is led to the second trick, until the next deal', () => {
        const session = startTestGame()
        const [p0, p1, p2] = forehandTakesEverything(session)
        declareByMeinSpiel(session, Contract.PiccoloOuvert)
        passAnnouncements(session)
        const seen = () =>
            project(session, { kind: 'player', playerId: p2 }).players.find(
                (player) => player.playerId === p1
            )?.hand
        for (let index = 0; index < 4; index++) {
            play(session)
        }
        expect(seen()).toBeUndefined()
        expect(session.activePlayerId()).toBe(p0)
        play(session)
        expect(seen()).toEqual(session.hand(p1))
        expect(
            project(session, { kind: 'spectator' }).players.every(
                (player) => player.hand !== undefined
            )
        ).toBe(true)
        for (let index = 0; index < 3; index++) {
            play(session)
        }
        expect(session.state.machineState).toBe(MachineState.Bidding)
        expect(seen()).toBeUndefined()
    })
})

describe('Farbensolo', () => {
    it('leaves the talon to the opponents', () => {
        const session = startTestGame()
        const declarer = declareByMeinSpiel(session, Contract.Farbensolo)
        expect(session.state.machineState).toBe(MachineState.Announcing)
        playOutHand(session)
        const cards = session.actions.filter(isPlayCard)
        const declarersCards = Array.from({ length: cards.length / 4 }, (_, trick) =>
            cards.slice(trick * 4, trick * 4 + 4)
        )
            .filter((trick) => trick[3]?.metadata?.trickWinnerId === declarer)
            .flatMap((trick) => trick.map((action) => action.cardId))
        const result = lastHandResult(session)
        expect(result?.talon).toHaveLength(6)
        expect(result?.declarerPoints).toBe(cardPoints(declarersCards))
    })
})

describe('Trischaken', () => {
    it('is Forehand’s to name after Mein Spiel, not to bid', () => {
        const session = startTestGame()
        const forehand = session.activePlayerId()
        expect(session.hydrated().biddableContracts(forehand)).not.toContain(Contract.Trischaken)
        session.act(forehand, ActionType.SayMeinSpiel)
        expect(session.hydrated().biddableContracts(session.activePlayerId())).not.toContain(
            Contract.Trischaken
        )
        for (let passes = 0; passes < 3; passes++) {
            session.act(session.activePlayerId(), ActionType.Pass)
        }
        expect(session.hydrated().nameableContracts()).toContain(Contract.Trischaken)
    })

    it('plays all twelve tricks and gives the talon to the last trick’s winner', () => {
        const session = startTestGame()
        const [p0, p1, p2, p3] = forehandTakesEverything(session)
        declareByMeinSpiel(session, Contract.Trischaken)
        expect(session.activePlayerId()).toBe(p0)
        playOutHand(session)
        const result = lastHandResult(session)
        expect(session.actions.filter(isPlayCard)).toHaveLength(48)
        expect(result?.playerTricks).toEqual({ [p0]: 12, [p1]: 0, [p2]: 0, [p3]: 0 })
        expect(result?.playerPoints).toEqual({ [p0]: 70, [p1]: 0, [p2]: 0, [p3]: 0 })
        // p0 pays 2 to each as a Bürgermeister and 2 to each for their empty hands; the three
        // tied at 0 settle no highest-to-lowest payment.
        expect(result?.scoreChanges).toEqual({ [p0]: -12, [p1]: 4, [p2]: 4, [p3]: 4 })
    })
})

describe('Zwiccolo and Farbendreier', () => {
    it('can be named and played out', () => {
        for (const contract of [Contract.Zwiccolo, Contract.Farbendreier]) {
            const session = startTestGame()
            declareByMeinSpiel(session, contract)
            playOutHand(session)
            expect(lastHandResult(session)?.contract).toBe(contract)
        }
    })

    it('lets the Farbendreier declarer take a talon half and lay away three', () => {
        const session = startTestGame()
        const declarer = declareByMeinSpiel(session, Contract.Farbendreier)
        expect(session.state.machineState).toBe(MachineState.ChoosingTalonHalf)
        expect(session.activePlayerId()).toBe(declarer)
        playOutHand(session)
        const result = lastHandResult(session)
        expect(result?.talon).toHaveLength(6)
        expect(result?.discards).toHaveLength(3)
    })
})
