import { describe, expect, it } from 'vitest'
import { Suit } from '../components/cards.js'
import { Contract } from '../components/contracts.js'
import { Bonus, Side } from '../model/announcements.js'
import { FourthKing } from '../model/kingCall.js'
import { TricksPerHand } from '../model/tricks.js'
import {
    declareByMeinSpiel,
    legalLayAway,
    passAnnouncements,
    playOutHand,
    setHands,
    startTestGame,
    type TestSession
} from '../util/testHelper.js'
import { ActionType } from './actions.js'
import { isEndHand } from '../actions/endHand.js'
import { TimesAround } from './config.js'
import { MachineState } from './states.js'

function lastHandResult(session: TestSession) {
    const endHand = session.actions.findLast(isEndHand)
    return endHand?.metadata
}

// Forehand p0 holds the hearts king; p2 holds the clubs king. Declarer's side gets the big cards.
function fixedDeal(session: TestSession) {
    const [p0, p1, p2, p3] = session.hydrated().seats()
    setHands(
        session,
        {
            [p0]: [
                'hearts-K',
                'trump-22',
                'trump-21',
                'trump-20',
                'trump-19',
                'trump-18',
                'hearts-Q',
                'hearts-C',
                'hearts-J',
                'diamonds-K',
                'diamonds-Q',
                'spades-K'
            ],
            [p1]: [
                'trump-2',
                'trump-3',
                'trump-4',
                'trump-5',
                'hearts-1',
                'hearts-2',
                'diamonds-1',
                'diamonds-2',
                'spades-10',
                'spades-9',
                'clubs-10',
                'clubs-9'
            ],
            [p2]: [
                'clubs-K',
                'trump-17',
                'trump-16',
                'trump-15',
                'trump-14',
                'trump-13',
                'clubs-Q',
                'clubs-C',
                'clubs-J',
                'spades-Q',
                'spades-C',
                'spades-J'
            ],
            [p3]: [
                'trump-6',
                'trump-7',
                'trump-8',
                'trump-9',
                'hearts-3',
                'hearts-4',
                'diamonds-3',
                'diamonds-4',
                'spades-8',
                'spades-7',
                'clubs-8',
                'clubs-7'
            ]
        },
        ['trump-1', 'trump-10', 'trump-11', 'trump-12', 'diamonds-C', 'diamonds-J']
    )
    return { p0, p1, p2, p3 }
}

describe('a Rufer hand', () => {
    it('runs from the auction through the talon and twelve tricks to the next deal', () => {
        const session = startTestGame()
        const { p0, p1, p2 } = fixedDeal(session)
        const firstDealer = session.state.dealerId
        expect(declareByMeinSpiel(session, Contract.Rufer)).toBe(p0)

        session.act(p0, ActionType.CallKing, { king: Suit.Clubs })
        expect(session.state.machineState).toBe(MachineState.ChoosingTalonHalf)
        expect(session.state.talonHalves).toEqual([
            ['trump-1', 'trump-10', 'trump-11'],
            ['trump-12', 'diamonds-C', 'diamonds-J']
        ])

        session.act(p0, ActionType.ChooseTalonHalf, { half: 0 })
        expect(session.hand(p0)).toHaveLength(15)
        const discards = legalLayAway(session.hand(p0), 3)
        session.act(p0, ActionType.LayAway, { cardIds: discards })
        expect(session.hand(p0)).toHaveLength(12)
        expect(session.state.machineState).toBe(MachineState.Announcing)
        expect(session.activePlayerId()).toBe(p0)
        passAnnouncements(session)
        expect(session.state.machineState).toBe(MachineState.Playing)
        expect(session.activePlayerId()).toBe(p0)

        playOutHand(session)
        const result = lastHandResult(session)
        expect(result).toMatchObject({ contract: Contract.Rufer, declarerId: p0, partnerId: p2 })
        expect(result?.discards).toEqual(discards)
        const changes = Object.values(result?.scoreChanges ?? {})
        expect(changes.reduce((sum, change) => sum + change, 0)).toBe(0)
        expect(result?.scoreChanges[p0]).toBe(result?.scoreChanges[p2])

        expect(session.state.machineState).toBe(MachineState.Bidding)
        expect(session.state.dealerId).toBe(p0)
        expect(session.state.dealerId).not.toBe(firstDealer)
        expect(session.activePlayerId()).toBe(p1)
        expect(session.state.roundManager.series).toHaveLength(2)
        for (const player of session.state.players) {
            expect(player.handCount).toBe(TricksPerHand)
            expect(player.discards).toEqual([])
        }
    })

    it('does not let declarer call their own king', () => {
        const session = startTestGame()
        const { p0 } = fixedDeal(session)
        declareByMeinSpiel(session, Contract.Rufer)
        expect(session.hydrated().callableKings(p0)).toEqual([Suit.Clubs, FourthKing])
        expect(() => session.act(p0, ActionType.CallKing, { king: Suit.Hearts })).toThrow()
    })

    it('leads the first trick from Forehand, and the winner leads the next', () => {
        const session = startTestGame()
        const { p0 } = fixedDeal(session)
        declareByMeinSpiel(session, Contract.Rufer)
        session.act(p0, ActionType.CallKing, { king: Suit.Clubs })
        session.act(p0, ActionType.ChooseTalonHalf, { half: 1 })
        session.act(p0, ActionType.LayAway, { cardIds: legalLayAway(session.hand(p0), 3) })
        passAnnouncements(session)
        for (let card = 0; card < 4; card++) {
            const playerId = session.activePlayerId()
            const [cardId] = session.hydrated().legalPlays(playerId)
            session.act(playerId, ActionType.PlayCard, { cardId })
        }
        const [trick] = session.state.tricks
        expect(trick.plays[0].playerId).toBe(p0)
        expect(session.activePlayerId()).toBe(trick.winnerId)
    })
})

describe('the called king in the talon', () => {
    // Moves the clubs king from p2 into the first talon half.
    function kingInTalon(session: TestSession) {
        const players = fixedDeal(session)
        session.edit((state) => {
            state.talon = [
                'clubs-K',
                'trump-10',
                'trump-11',
                'trump-12',
                'diamonds-C',
                'diamonds-J'
            ]
            const holder = state.players.find((player) => player.playerId === players.p2)
            if (holder?.hand) {
                holder.hand = holder.hand.map((cardId) =>
                    cardId === 'clubs-K' ? 'trump-1' : cardId
                )
            }
        })
        return players
    }

    it('lets declarer give up and pay the game to each opponent', () => {
        const session = startTestGame()
        const { p0, p1, p2, p3 } = kingInTalon(session)
        declareByMeinSpiel(session, Contract.Rufer)
        session.act(p0, ActionType.CallKing, { king: Suit.Clubs })
        expect(session.validActions(p0)).toEqual([ActionType.ChooseTalonHalf, ActionType.GiveUp])
        session.act(p0, ActionType.GiveUp)
        const result = lastHandResult(session)
        expect(result).toMatchObject({
            contract: Contract.Rufer,
            declarerId: p0,
            made: false,
            givenUp: true,
            scoreChanges: { [p0]: -3, [p1]: 1, [p2]: 1, [p3]: 1 }
        })
        expect(result?.talon).toContain('clubs-K')
        expect(session.state.machineState).toBe(MachineState.Bidding)
    })

    it('has a Besserrufer who gives up pay the named bird in full as well', () => {
        const session = startTestGame()
        const { p0, p1, p2, p3 } = kingInTalon(session)
        declareByMeinSpiel(session, Contract.Besserrufer, Bonus.Uhu)
        session.act(p0, ActionType.CallKing, { king: Suit.Clubs })
        session.act(p0, ActionType.GiveUp)
        const result = lastHandResult(session)
        expect(result).toMatchObject({
            contract: Contract.Besserrufer,
            givenUp: true,
            bonuses: [
                {
                    bonus: Bonus.Uhu,
                    side: Side.Declarer,
                    announced: true,
                    doubles: 0,
                    made: false,
                    points: -4
                }
            ],
            scoreChanges: { [p0]: -15, [p1]: 5, [p2]: 5, [p3]: 5 }
        })
        expect(session.state.machineState).toBe(MachineState.Bidding)
    })

    it('lets declarer play alone against three instead', () => {
        const session = startTestGame()
        const { p0 } = kingInTalon(session)
        declareByMeinSpiel(session, Contract.Rufer)
        session.act(p0, ActionType.CallKing, { king: Suit.Clubs })
        playOutHand(session)
        const result = lastHandResult(session)
        expect(result?.partnerId).toBeUndefined()
        expect(result?.givenUp).toBeUndefined()
        expect(Math.abs(result?.scoreChanges[p0] ?? 0)).toBe(3)
    })

    it('allows no Kontra after declarer takes a half to play alone', () => {
        const session = startTestGame()
        const { p0, p1 } = kingInTalon(session)
        declareByMeinSpiel(session, Contract.Rufer)
        session.act(p0, ActionType.CallKing, { king: Suit.Clubs })
        session.act(p0, ActionType.ChooseTalonHalf, { half: 0 })
        session.act(p0, ActionType.LayAway, { cardIds: legalLayAway(session.hand(p0), 3) })
        expect(session.state.machineState).toBe(MachineState.Announcing)
        session.act(p0, ActionType.Announce, { bonuses: [], doubles: [] })
        expect(session.hydrated().doubleTargets(p1)).toEqual([])
        expect(() =>
            session.act(p1, ActionType.Announce, { bonuses: [], doubles: [{ kind: 'game' }] })
        ).toThrow()
    })

    it('offers no giving up when the called king is out', () => {
        const session = startTestGame()
        const { p0 } = fixedDeal(session)
        declareByMeinSpiel(session, Contract.Rufer)
        session.act(p0, ActionType.CallKing, { king: Suit.Clubs })
        expect(session.validActions(p0)).toEqual([ActionType.ChooseTalonHalf])
        expect(() => session.act(p0, ActionType.GiveUp)).toThrow()
    })
})

describe('calling "the fourth king"', () => {
    it('names no suit, and makes the holder of the one king declarer lacks the partner', () => {
        const session = startTestGame()
        const { p0, p2 } = fixedDeal(session)
        declareByMeinSpiel(session, Contract.Rufer)
        session.act(p0, ActionType.CallKing, { king: FourthKing })
        expect(session.state.contract?.calledKing).toBe(FourthKing)
        playOutHand(session)
        const result = lastHandResult(session)
        expect(result?.partnerId).toBe(p2)
        expect(result?.scoreChanges[p0]).toBe(result?.scoreChanges[p2])
    })

    it('is not open to a declarer without exactly three kings', () => {
        const session = startTestGame()
        const { p0 } = fixedDeal(session)
        session.edit((state) => {
            const declarer = state.players.find((player) => player.playerId === p0)
            if (declarer?.hand) {
                declarer.hand = declarer.hand.map((cardId) =>
                    cardId === 'spades-K' ? 'trump-1' : cardId
                )
            }
            state.talon = [
                'spades-K',
                'trump-10',
                'trump-11',
                'trump-12',
                'diamonds-C',
                'diamonds-J'
            ]
        })
        declareByMeinSpiel(session, Contract.Rufer)
        expect(session.hydrated().callableKings(p0)).not.toContain(FourthKing)
        expect(() => session.act(p0, ActionType.CallKing, { king: FourthKing })).toThrow()
    })

    it('in a Solorufer, gives declarer the talon half holding the fourth king', () => {
        const session = startTestGame()
        const { p0 } = fixedDeal(session)
        session.edit((state) => {
            state.talon = [
                'clubs-K',
                'trump-10',
                'trump-11',
                'trump-12',
                'diamonds-C',
                'diamonds-J'
            ]
            const holder = state.players.find((player) => player.hand?.includes('clubs-K'))
            if (holder?.hand) {
                holder.hand = holder.hand.map((cardId) =>
                    cardId === 'clubs-K' ? 'trump-1' : cardId
                )
            }
        })
        session.act(p0, ActionType.Bid, { contract: Contract.Solorufer })
        for (let passes = 0; passes < 3; passes++) {
            session.act(session.activePlayerId(), ActionType.Pass)
        }
        session.act(p0, ActionType.CallKing, { king: FourthKing })
        playOutHand(session)
        const result = lastHandResult(session)
        expect(result?.partnerId).toBeUndefined()
        expect(Math.abs(result?.scoreChanges[p0] ?? 0)).toBe(6)
    })
})

describe('contracts without a talon exchange', () => {
    it('gives a Solorufer’s declarer the untouched talon half holding the called king', () => {
        const session = startTestGame()
        const { p0 } = fixedDeal(session)
        session.edit((state) => {
            state.talon = [
                'clubs-K',
                'trump-10',
                'trump-11',
                'trump-12',
                'diamonds-C',
                'diamonds-J'
            ]
            const holder = state.players.find((player) => player.hand?.includes('clubs-K'))
            if (holder?.hand) {
                holder.hand = holder.hand.map((cardId) =>
                    cardId === 'clubs-K' ? 'trump-1' : cardId
                )
            }
        })
        session.act(p0, ActionType.Bid, { contract: Contract.Solorufer })
        for (let passes = 0; passes < 3; passes++) {
            session.act(session.activePlayerId(), ActionType.Pass)
        }
        session.act(p0, ActionType.CallKing, { king: Suit.Clubs })
        expect(session.state.machineState).toBe(MachineState.Announcing)
        playOutHand(session)
        const result = lastHandResult(session)
        expect(result?.partnerId).toBeUndefined()
        expect(result?.talon).toContain('clubs-K')
        expect(Math.abs(result?.scoreChanges[p0] ?? 0)).toBe(6)
    })

    it('has Sechserdreier take all six talon cards and lay six away', () => {
        const session = startTestGame()
        const { p0 } = fixedDeal(session)
        session.act(p0, ActionType.Bid, { contract: Contract.Sechserdreier })
        for (let passes = 0; passes < 3; passes++) {
            session.act(session.activePlayerId(), ActionType.Pass)
        }
        expect(session.state.machineState).toBe(MachineState.LayingAway)
        expect(session.hand(p0)).toHaveLength(18)
        session.act(p0, ActionType.LayAway, { cardIds: legalLayAway(session.hand(p0), 6) })
        expect(session.hand(p0)).toHaveLength(12)
        playOutHand(session)
        expect(lastHandResult(session)?.contract).toBe(Contract.Sechserdreier)
    })
})

describe('a whole game', () => {
    it('shuffles afresh for every deal', () => {
        const session = startTestGame()
        const deals: string[] = []
        for (let deal = 0; deal < 3; deal++) {
            deals.push(session.hand(session.hydrated().forehandId()).toSorted().join(' '))
            declareByMeinSpiel(session, Contract.Rufer)
            playOutHand(session)
        }
        expect(new Set(deals).size).toBe(3)
    })

    it('deals the chosen number of times around the table and ends with the highest score winning', () => {
        const session = startTestGame({ timesAround: TimesAround.Two })
        const dealers: string[] = []
        while (session.state.machineState !== MachineState.EndOfGame) {
            dealers.push(session.state.dealerId)
            declareByMeinSpiel(session, Contract.Rufer)
            playOutHand(session)
        }
        expect(dealers).toHaveLength(8)
        for (const playerId of session.hydrated().seats()) {
            expect(dealers.filter((dealer) => dealer === playerId)).toHaveLength(2)
        }
        const scores = session.state.players.map((player) => player.score)
        expect(scores.reduce((sum, score) => sum + score, 0)).toBe(0)
        const best = Math.max(...scores)
        expect(session.state.winningPlayerIds).toEqual(
            session.state.players
                .filter((player) => player.score === best)
                .map((player) => player.playerId)
        )
        expect(session.state.activePlayerIds).toEqual([])
    })
})
