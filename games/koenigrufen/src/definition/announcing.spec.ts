import { describe, expect, it } from 'vitest'
import { isEndHand } from '../actions/endHand.js'
import { Deck, trumpId } from '../components/cards.js'
import { Contract } from '../components/contracts.js'
import { Bonus, Side } from '../model/announcements.js'
import {
    advanceTo,
    declareByMeinSpiel,
    playOutHand,
    setHands,
    startTestGame,
    type TestSession
} from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

function lastHandResult(session: TestSession) {
    return session.actions.findLast(isEndHand)?.metadata
}

function say(session: TestSession, bonuses: Bonus[] = [], doubles: object[] = []) {
    session.act(session.activePlayerId(), ActionType.Announce, { bonuses, doubles })
}

describe('the announcements', () => {
    it('start with declarer once the talon is settled, and end after three passes', () => {
        const session = startTestGame()
        const declarer = declareByMeinSpiel(session, Contract.Rufer)
        advanceTo(session, [MachineState.Announcing])
        expect(session.activePlayerId()).toBe(declarer)
        say(session, [Bonus.Trull])
        for (let passes = 0; passes < 3; passes++) {
            expect(session.state.machineState).toBe(MachineState.Announcing)
            say(session)
        }
        expect(session.state.machineState).toBe(MachineState.Playing)
        expect(session.state.announcements?.bonuses).toEqual([
            { bonus: Bonus.Trull, side: Side.Declarer, playerId: declarer, doubles: 0 }
        ])
    })

    it('skip Trischaken', () => {
        const session = startTestGame()
        declareByMeinSpiel(session, Contract.Trischaken)
        expect(session.state.machineState).toBe(MachineState.Playing)
    })

    it('double the game for a Kontra', () => {
        const session = startTestGame()
        const declarer = declareByMeinSpiel(session, Contract.Dreier)
        advanceTo(session, [MachineState.Announcing])
        say(session)
        const defender = session.activePlayerId()
        expect(session.hydrated().doubleTargets(defender)).toEqual([{ kind: 'game' }])
        say(session, [], [{ kind: 'game' }])
        playOutHand(session)
        const result = lastHandResult(session)
        expect(result?.gameDoubles).toEqual([{ doubles: 1 }])
        const game = (result?.made ? 4 : -4) * 2
        const bonuses = (result?.bonuses ?? []).reduce(
            (sum, bonus) => sum + (bonus.side === Side.Declarer ? bonus.points : -bonus.points),
            0
        )
        expect(result?.scoreChanges[defender]).toBe(-(game + bonuses))
        expect(result?.scoreChanges[declarer]).toBe(3 * (game + bonuses))
    })

    it('make a Besserrufer declarer open with a bird', () => {
        const session = startTestGame()
        const declarer = declareByMeinSpiel(session, Contract.Besserrufer)
        advanceTo(session, [MachineState.Announcing])
        expect(session.hydrated().mustAnnounceBird(declarer)).toBe(true)
        expect(() => say(session)).toThrow()
        say(session, [Bonus.Pagat])
        playOutHand(session)
        expect(lastHandResult(session)?.bonuses).toContainEqual(
            expect.objectContaining({ bonus: Bonus.Pagat, announced: true, side: Side.Declarer })
        )
    })

    it('keep an announced bird back until its trick unless nothing else may be played', () => {
        const session = startTestGame()
        const [p0, p1, p2, p3] = session.hydrated().seats()
        const suitCards = Deck.filter((card) => card.kind === 'suit').map((card) => card.id)
        const trumps = Array.from({ length: 22 }, (_, index) => trumpId(index + 1))
        // p0 holds the Pagat, the Uhu and the ten highest trumps; p1 the other trumps.
        setHands(
            session,
            {
                [p0]: [trumpId(1), trumpId(2), ...trumps.slice(12, 22)],
                [p1]: [...trumps.slice(2, 12), ...suitCards.slice(0, 2)],
                [p2]: suitCards.slice(2, 14),
                [p3]: suitCards.slice(14, 26)
            },
            suitCards.slice(26, 32)
        )
        declareByMeinSpiel(session, Contract.Solodreier)
        say(session, [Bonus.Uhu])
        for (let passes = 0; passes < 3; passes++) {
            say(session)
        }
        expect(session.activePlayerId()).toBe(p0)
        expect(session.hydrated().legalPlays(p0)).toContain(trumpId(1))
        expect(session.hydrated().legalPlays(p0)).not.toContain(trumpId(2))
        playOutHand(session)
        expect(lastHandResult(session)?.bonuses).toContainEqual(
            expect.objectContaining({ bonus: Bonus.Uhu, announced: true })
        )
    })
})
