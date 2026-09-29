import { engine } from '../testing/engine.js'
import { buildAction } from '../testing/actions.js'
import { describe, expect, it } from 'vitest'
import { ActionSource, Color, Game, GameResult, type GameAction } from '@tabletop/common'
import { ActionType } from '../definition/actions.js'
import { MachineState } from '../definition/states.js'
import { Search, SearchSource } from '../actions/search.js'
import { SearchPlay, SearchResolve } from '../actions/searchResolve.js'
import { HydratedPeek, Peek, PeekTargetKind } from '../actions/peek.js'
import { CompleteRest } from '../actions/completeRest.js'
import { EndActPhase } from '../actions/endActPhase.js'
import { Muster } from '../actions/muster.js'
import { OfferCitizenship } from '../actions/offerCitizenship.js'
import { ResolveCitizenshipOffer } from '../actions/resolveCitizenshipOffer.js'
import { AnswerConsent } from '../actions/answerConsent.js'
import { MoveWarbands } from '../actions/moveWarbands.js'
import { WarbandMoveKind } from '../model/warbandMove.js'
import { ResolveOathkeeper } from '../actions/resolveOathkeeper.js'
import { ResolveWake } from '../actions/resolveWake.js'
import { SelfExile } from '../actions/selfExile.js'
import { Trade, TradeOption } from '../actions/trade.js'
import { Travel } from '../actions/travel.js'
import { Banner, OathType, PlayerStatus, Region, Suit } from '../model/oathEnums.js'
import { testBanners, testPlayer, testState, testVaultWithRelics } from '../testing/fixture.js'
import { HydratedOathGameState, type OathProjectedState } from '../model/gameState.js'
import type { OathPlayerState } from '../model/playerState.js'
import { EXILE_REFRESH_BANDS, MAX_SUPPLY, refreshSpaceFor } from '../util/rest.js'
import { required } from '../testing/required.js'
import { testGame } from '../testing/game.js'

const ORDER = 'denizen.order.wrestlers'
const BEAST = 'denizen.beast.rangers'
const HEARTH = 'denizen.hearth.ballot-box'
function buildState(
    overrides: Partial<OathProjectedState> = {},
    playerOverrides: Record<string, Partial<OathPlayerState>> = {}
): OathProjectedState {
    const seats: OathPlayerState[] = [
        testPlayer({
            playerId: 'p1',
            color: Color.Purple,
            status: PlayerStatus.Chancellor,
            siteId: 'c1',
            supply: 7,
            favor: 4,
            secrets: 2,
            warbandsInPersonalBank: { purple: 5 },
            ...playerOverrides['p1']
        }),
        testPlayer({
            playerId: 'p2',
            color: Color.Red,
            status: PlayerStatus.Exile,
            siteId: 'c2',
            supply: 7,
            warbandsInPersonalBank: { [Color.Red]: 4 },
            ...playerOverrides['p2']
        })
    ]

    const state = testState(seats, {
        denizensBySite: { c1: [ORDER, BEAST, HEARTH], c2: [] },
        machineState: MachineState.WakePhase,
        chancellorPlayerId: 'p1',
        ...overrides
    }).dehydrate()

    state.turnManager = {
        series: [{ type: 'turn', playerId: 'p1', start: 0 }],
        turnOrder: ['p1', 'p2'],
        turnCounts: { p1: 0, p2: 0 }
    }
    state.activePlayerIds = ['p1']
    return state
}

let actionSeq = 0
function action(built: GameAction) {
    actionSeq += 1
    return { ...built, id: `a-${actionSeq}` }
}

function wake(state: OathProjectedState, game: Game, playerId: string) {
    if (state.machineState !== MachineState.WakePhase) {
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual([playerId])
        return state
    }
    return engine.runNext(buildAction(ResolveWake, { playerId, favorSteps: [] }), state, game).updatedState
}

function endTurn(state: OathProjectedState, game: Game, playerId: string) {
    let next = engine.runNext(buildAction(EndActPhase, { playerId }), state, game).updatedState
    next = engine.runNext(buildAction(CompleteRest, { playerId }), next, game).updatedState
    return next
}

/** R-6.6.1 */
function reliquaryVault() {
    const vault = testVaultWithRelics({})
    vault.relicFacedown['reliquary.0'] = 'relic.cup'
    return vault
}

function citizenshipTable(
    playerOverrides: Record<string, Partial<OathPlayerState>> = {
        p1: { relicIds: ['relic.grand-scepter'] }
    }
): OathProjectedState {
    const state = buildState(
        { reliquary: [{ slotId: 'reliquary.0' }], vault: reliquaryVault() },
        playerOverrides
    )
    return wake(state, testGame(['p1', 'p2']), 'p1')
}

function offerCitizenship(
    state: OathProjectedState,
    game: Game,
    playerId: string,
    exilePlayerId: string
) {
    return engine.runNext(buildAction(OfferCitizenship, {
        playerId,
        exilePlayerId,
        reliquarySlotId: 'reliquary.0'
    }), state, game).updatedState
}

describe('R-4 — a turn is Wake, then Act, then Rest', () => {
    it('walks the three phases in order and hands on to the next player', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState()
        expect(state.machineState).toBe(MachineState.WakePhase)

        state = wake(state, game, 'p1')
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p1'])

        state = engine.runNext(buildAction(EndActPhase, { playerId: 'p1' }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.RestPhase)
        expect(state.activePlayerIds).toEqual(['p1'])

        state = engine.runNext(buildAction(CompleteRest, { playerId: 'p1' }), state, game).updatedState
        // R-4.1 — p2's Wake has nothing to decide, so the engine resolves it in the same run.
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p2'])
        expect(state.turnManager.turnCounts['p1']).toBe(1)
    })

    it('cycles turn order round the table (R-4)', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState()

        for (const expected of ['p2', 'p1', 'p2']) {
            const current = state.activePlayerIds[0]
            state = wake(state, game, current)
            state = endTurn(state, game, current)
            expect(state.activePlayerIds).toEqual([expected])
        }
    })

    it('advances the round only when the last player in order has rested (R-4)', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState()
        expect(state.round).toBe(1)

        state = wake(state, game, 'p1')
        state = endTurn(state, game, 'p1')
        expect(state.round).toBe(1)

        state = wake(state, game, 'p2')
        state = endTurn(state, game, 'p2')
        expect(state.round).toBe(2)
    })
})

describe('R-4.2 — the Act Phase spans any number of actions', () => {
    it('keeps the turn with the acting player across repeated actions', () => {
        const game = testGame(['p1', 'p2'])
        let state = wake(buildState(), testGame(['p1', 'p2']), 'p1')

        for (const cardId of [ORDER, BEAST, HEARTH]) {
            state = engine.runNext(buildAction(Muster, { playerId: 'p1', cardId }), state, game).updatedState
            expect(state.activePlayerIds).toEqual(['p1'])
            expect(state.machineState).toBe(MachineState.ActPhase)
        }

        expect(state.turnManager.series).toHaveLength(1)
    })

    it('allows zero actions — Wake straight to Rest (R-4.2)', () => {
        const game = testGame(['p1', 'p2'])
        let state = wake(buildState(), game, 'p1')
        state = endTurn(state, game, 'p1')
        expect(state.turnManager.turnCounts['p1']).toBe(1)
    })

    it('stays with the acting player across a Search and its resolution', () => {
        const game = testGame(['p1', 'p2'])
        let state = wake(buildState(), game, 'p1')
        const vault = testVaultWithRelics({})
        vault.worldDeck = [ORDER, BEAST, HEARTH]
        const search = action(buildAction(Search, {
            playerId: 'p1',
            drawFrom: SearchSource.WorldDeck,
            revealsInfo: true,
            index: state.actionCount
        }))
        state.vault = vault
        let result = engine.run(search, state, game)
        state = result.updatedState

        expect(state.machineState).toBe(MachineState.Searching)
        expect(state.activePlayerIds).toEqual(['p1'])

        result = engine.run(
            action(buildAction(SearchResolve, {
                playerId: 'p1',
                keptCardId: ORDER,
                discardOrder: [BEAST, HEARTH],
                play: SearchPlay.Adviser,
                index: state.actionCount
            })),
            state,
            game
        )
        state = result.updatedState

        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(state.turnManager.series).toHaveLength(1)
        expect(state.vault?.discardPiles[Region.Provinces]).toEqual([HEARTH, BEAST])
    })

    it('runs the whole action through the engine, hydrator included', () => {
        const game = testGame(['p1', 'p2'])
        const state = wake(buildState(), game, 'p1')
        const result = engine.run(
            action(buildAction(Trade, {
                playerId: 'p1',
                cardId: ORDER,
                option: TradeOption.ForFavor,
                index: state.actionCount
            })),
            state,
            game
        )

        expect(result.processedActions).toHaveLength(1)
        expect(result.updatedState.favorBank[Suit.Order]).toBe(2)
    })
})

describe('R-4.1 — the Wake Phase through the engine', () => {
    it('resolves the People’s Favor power for its holder, and rejects a wrong count', () => {
        const game = testGame(['p1', 'p2'])
        const state = buildState(
            { banners: testBanners({ [Banner.PeoplesFavor]: 'p1' }) },
            { p1: { favor: 4 } }
        )

        // R-4.1.1 is mandatory for the holder, so an empty declaration fails.
        expect(() => wake(state, game, 'p1')).toThrow(/still able/)

        const done = engine.runNext(buildAction(ResolveWake, {
            playerId: 'p1',
            favorSteps: [{ kind: 'place' }]
        }), state, game).updatedState
        expect(done.banners[Banner.PeoplesFavor].value).toBe(2)
        expect(done.players[0].favor).toBe(3)
    })

    it('rejects favor steps from a player who does not hold it (R-4.1.1)', () => {
        const game = testGame(['p1', 'p2'])
        const state = buildState()
        expect(() =>
            engine.runNext(buildAction(ResolveWake, {
                playerId: 'p1',
                favorSteps: [{ kind: 'place' }]
            }), state, game).updatedState
        ).toThrow(/do not hold the People’s Favor/)
    })

    it('offers only the Wake action in the Wake Phase (R-4.1)', () => {
        const game = testGame(['p1', 'p2'])
        const state = buildState()
        expect(engine.getValidActionTypesForPlayer(game, state, 'p1')).toEqual([
            ActionType.ResolveWake
        ])
    })
})

describe('R-4.3 — the Rest Phase through the engine', () => {
    it('returns favor and secrets and refreshes Supply on entering Rest', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState({
            cardTokens: { [ORDER]: { favor: 2, secrets: 1 } }
        })
        state = wake(state, game, 'p1')
        state = engine.runNext(buildAction(EndActPhase, { playerId: 'p1' }), state, game).updatedState

        // R-4.3.1, R-4.3.2
        expect(state.favorBank[Suit.Order]).toBe(5)
        expect(state.cardTokens[ORDER]).toEqual({ favor: 0, secrets: 0 })
        expect(state.players[0].secrets).toBe(3)
        // R-4.3.3, R-4.3.4 — capped at the leftmost space.
        expect(state.players[0].supply).toBe(7)
    })

    it('offers only the Rest completion in the Rest Phase (R-4.3.5)', () => {
        const game = testGame(['p1', 'p2'])
        let state = wake(buildState(), game, 'p1')
        state = engine.runNext(buildAction(EndActPhase, { playerId: 'p1' }), state, game).updatedState
        expect(engine.getValidActionTypesForPlayer(game, state, 'p1')).toEqual([
            ActionType.CompleteRest
        ])
    })

    it('does not let supplySpentThisTurn leak into the next turn (R-4.3.4)', () => {
        const game = testGame(['p1', 'p2'])
        let state = wake(buildState(), game, 'p1')
        state = engine.runNext(buildAction(Muster, { playerId: 'p1', cardId: ORDER }), state, game).updatedState
        expect(state.players[0].supplySpentThisTurn).toBe(1)

        state = endTurn(state, game, 'p1')
        expect(state.players[0].supplySpentThisTurn).toBe(0)
    })
})

describe('Wake stamps the turn’s Supply baseline (R-4.1, R-4.3.4)', () => {
    it('takes the current marker as the baseline, not the one Rest left', () => {
        const game = testGame(['p1', 'p2'])
        // R-6.7 — Supply refreshed between turns, baseline still 3.
        let state = buildState({}, { p2: { supply: MAX_SUPPLY, supplyAtTurnStart: 3 } })

        state = wake(state, game, 'p1')
        state = endTurn(state, game, 'p1')
        state = wake(state, game, 'p2')

        const p2 = state.players[1]
        expect(p2.supply).toBe(MAX_SUPPLY)
        expect(p2.supplyAtTurnStart).toBe(MAX_SUPPLY)
        expect(p2.supplySpentThisTurn).toBe(0)
    })
})

describe('R-2.11-H1 — the title is re-evaluated after every action', () => {
    it('takes the title the moment a player meets the goal', () => {
        const game = testGame(['p1', 'p2'])
        const state = buildState({
            oathType: OathType.ThePeople,
            banners: testBanners({ [Banner.PeoplesFavor]: 'p2' })
        })
        expect(state.oathkeeperPlayerId).toBeUndefined()

        const after = wake(state, game, 'p1')
        expect(after.oathkeeperPlayerId).toBe('p2')
        expect(after.oathkeeperIsUsurper).toBe(false)
    })

    it('moves it mid-turn when an action changes who meets the goal', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState({
            oathType: OathType.Supremacy,
            warbandsBySite: { c1: { purple: 1 } },
            oathkeeperPlayerId: 'p1'
        })
        state = wake(state, game, 'p1')
        expect(state.oathkeeperPlayerId).toBe('p1')

        state.warbandsBySite = { c1: { purple: 1 }, c2: { red: 1 }, p1: { red: 1 } }
        state = engine.runNext(buildAction(Muster, { playerId: 'p1', cardId: ORDER }), state, game).updatedState
        expect(state.oathkeeperPlayerId).toBe('p2')
    })
})

describe('R-3.3 — the Stable Regime Win at a round boundary', () => {
    function atRoundEnd(round: number) {
        const game = testGame(['p1', 'p2'])
        let state = buildState({
            round,
            oathType: OathType.ThePeople,
            banners: testBanners({ [Banner.PeoplesFavor]: 'p1' })
        })
        state = engine.runNext(buildAction(ResolveWake, {
            playerId: 'p1',
            favorSteps: [{ kind: 'place' }]
        }), state, game).updatedState
        state = endTurn(state, game, 'p1')
        state = wake(state, game, 'p2')
        return { game, state }
    }

    it('rolls the end die at the end of the fifth round and records it', () => {
        const { game, state } = atRoundEnd(5)
        const before = state.prng.invocations

        const after = endTurn(state, game, 'p2')
        expect(after.prng.invocations).toBe(before + 1)
    })

    it('does not roll before the fifth round', () => {
        const { game, state } = atRoundEnd(3)
        const before = state.prng.invocations
        const after = endTurn(state, game, 'p2')
        expect(after.prng.invocations).toBe(before)
        expect(after.round).toBe(4)
    })

    it('does not roll when an Exile holds the title (R-3.3)', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState({
            round: 6,
            oathType: OathType.ThePeople,
            // Value 2: the return below must clear R-4.1.1-H1's floor of one.
            banners: testBanners({ [Banner.PeoplesFavor]: 'p2' }, 2)
        })
        state = wake(state, game, 'p1')
        state = endTurn(state, game, 'p1')
        state = engine.runNext(buildAction(ResolveWake, {
            playerId: 'p2',
            favorSteps: [{ kind: 'return', toSuit: Suit.Discord }]
        }), state, game).updatedState

        const before = state.prng.invocations
        const after = endTurn(state, game, 'p2')
        expect(after.prng.invocations).toBe(before)
        expect(after.round).toBe(7)
    })

    it('ends the game and records the Chancellor when the die passes', () => {
        // R-3.3 — round seven ends on 3 to 6; the seed is searched because dice are never mocked.
        let ended: OathProjectedState | undefined
        for (let seed = 1; seed < 60 && !ended; seed += 1) {
            const game = testGame(['p1', 'p2'])
            let state = buildState({
                round: 7,
                prng: { seed, invocations: 0 },
                oathType: OathType.ThePeople,
                banners: testBanners({ [Banner.PeoplesFavor]: 'p1' })
            })
            state = engine.runNext(buildAction(ResolveWake, {
                playerId: 'p1',
                favorSteps: [{ kind: 'place' }]
            }), state, game).updatedState
            state = endTurn(state, game, 'p1')
            state = wake(state, game, 'p2')
            const after = endTurn(state, game, 'p2')
            if (after.machineState === MachineState.EndOfGame) ended = after
        }

        const finished = required(ended, 'the finished game')
        expect(finished.winningPlayerIds).toEqual(['p1'])
        expect(finished.result).toBe(GameResult.Win)
    })
})

describe('R-3.4 — the eighth round ends the game automatically', () => {
    it('ends with no die rolled, and resolves a winner', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState({
            round: 8,
            oathType: OathType.ThePeople,
            banners: testBanners({ [Banner.PeoplesFavor]: 'p1' })
        })
        state = engine.runNext(buildAction(ResolveWake, {
            playerId: 'p1',
            favorSteps: [{ kind: 'place' }]
        }), state, game).updatedState
        state = endTurn(state, game, 'p1')
        state = wake(state, game, 'p2')

        const before = state.prng.invocations
        const after = endTurn(state, game, 'p2')

        expect(after.prng.invocations).toBe(before)
        expect(after.machineState).toBe(MachineState.EndOfGame)
        // R-3.4.1 — the Empire holds the title, so the Chancellor wins.
        expect(after.winningPlayerIds).toEqual(['p1'])
        expect(after.round).toBe(8)
    })
})

describe('R-6.6.2 and R-6.8 end the Act Phase from inside a minor action', () => {
    // R-6.4-H1 — the Scepter's holder is taught the Reliquary, so the vault holds its relics.
    const reliquaryVault = () =>
        testVaultWithRelics(Object.fromEntries([0, 1, 2, 3].map((i) => [`reliquary.${i}`, `relic.unnamed-${i + 1}`])))

    it('R-6.8 — self-exiling ends the acting player’s own Act Phase', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState(
            { vault: reliquaryVault() },
            {
                p1: { status: PlayerStatus.Citizen, favor: 10, secrets: 0 },
                p2: { relicIds: ['relic.grand-scepter'] }
            }
        )
        state = wake(state, game, 'p1')
        expect(state.machineState).toBe(MachineState.ActPhase)

        state = engine.runNext(buildAction(SelfExile, { playerId: 'p1' }), state, game).updatedState

        expect(state.machineState).toBe(MachineState.RestPhase)
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(state.players[0].status).toBe(PlayerStatus.Exile)
    })

    // R-6.8 — Rest follows in the same turn; R-4.3.4's saving is read from the Supply spent, not the marker.
    it('R-4.3.4 — Supply spent before a self-exile stays spent through Rest', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState(
            { vault: reliquaryVault() },
            {
                p1: {
                    status: PlayerStatus.Citizen,
                    favor: 10,
                    secrets: 0,
                    warbandsInPersonalBank: { [Color.Blue]: 1 },
                    warbandsOnBoard: { purple: 2 }
                },
                p2: { relicIds: ['relic.grand-scepter'] }
            }
        )
        state = wake(state, game, 'p1')
        expect(state.players[0].supplyAtTurnStart).toBe(MAX_SUPPLY)

        // R-5.6.1 — spend the whole track: a saving of 3 plus the base of 4 would also reach 7 and hide a marker reading.
        state = engine.runNext(buildAction(Travel, { playerId: 'p1', siteId: 'h1' }), state, game).updatedState
        state = engine.runNext(buildAction(Travel, { playerId: 'p1', siteId: 'h2' }), state, game).updatedState
        const spent = state.players[0].supplySpentThisTurn
        expect(spent).toBe(MAX_SUPPLY)

        // R-4.3.1 to R-4.3.4 run on entering Rest, so this call already refreshes Supply.
        state = engine.runNext(buildAction(SelfExile, { playerId: 'p1' }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.RestPhase)
        expect(state.players[0].status).toBe(PlayerStatus.Exile)

        // R-4.3.3, R-4.3.4
        const rested = state.players[0].supply
        expect(rested).toBeLessThan(MAX_SUPPLY)
        const bank = Object.values(state.players[0].warbandsInPersonalBank).reduce(
            (n, c) => n + c,
            0
        )
        expect(rested).toBe(
            Math.min(
                MAX_SUPPLY,
                refreshSpaceFor(EXILE_REFRESH_BANDS, bank) + (MAX_SUPPLY - spent)
            )
        )

        expect(state.players[0].supplySpentThisTurn).toBe(0)
        expect(state.players[0].supplyAtTurnStart).toBe(rested)
    })

    it('R-6.6.2 — the phase that ends is the NEW CITIZEN’s, not the offerer’s', () => {
        const game = testGame(['p1', 'p2'])
        let state = citizenshipTable()
        state = offerCitizenship(state, game, 'p1', 'p2')
        state = engine.runNext(buildAction(ResolveCitizenshipOffer, {
            playerId: 'p2',
            granted: true
        }), state, game).updatedState

        expect(state.players[1].status).toBe(PlayerStatus.Citizen)
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('R-6.6.2 — a self-offer on your own turn does end it', () => {
        // R-6.6.1 — a player may offer citizenship to themselves.
        const game = testGame(['p1', 'p2'])
        let state = citizenshipTable({
            p1: { status: PlayerStatus.Exile, relicIds: ['relic.grand-scepter'] }
        })
        state = offerCitizenship(state, game, 'p1', 'p1')
        expect(state.activePlayerIds).toEqual(['p1'])

        state = engine.runNext(buildAction(ResolveCitizenshipOffer, {
            playerId: 'p1',
            granted: true
        }), state, game).updatedState

        expect(state.players[0].status).toBe(PlayerStatus.Citizen)
        expect(state.machineState).toBe(MachineState.RestPhase)
    })
})

/** The platform notifies every player newly added to `activePlayerIds`. */
describe('R-X.1 — a question is a turn, through the engine', () => {
    it('puts the asked player on the clock, not the player whose turn it is', () => {
        const game = testGame(['p1', 'p2'])
        let state = citizenshipTable()
        state = offerCitizenship(state, game, 'p1', 'p2')

        expect(state.machineState).toBe(MachineState.ConsentRequest)
        expect(state.activePlayerIds).toEqual(['p2'])
        expect(state.pendingConsent?.askedPlayerId).toBe('p2')
        expect(state.pendingConsent?.askingPlayerId).toBe('p1')
        // R-6.6.1
        expect(state.players[1].status).toBe(PlayerStatus.Exile)
    })

    it("offers the asked player exactly one action, and the asker none of the turn's", () => {
        const game = testGame(['p1', 'p2'])
        let state = citizenshipTable()
        state = offerCitizenship(state, game, 'p1', 'p2')

        expect(engine.getValidActionTypesForPlayer(game, state, 'p2')).toEqual([
            ActionType.ResolveCitizenshipOffer
        ])
        // R-4.2 — the asker cannot act around the question; R-9.4's peek is no action of the turn.
        expect(engine.getValidActionTypesForPlayer(game, state, 'p1')).toEqual([ActionType.LetPeek])
        expect(engine.getValidActionTypesForPlayer(game, state, 'p2')).toContain(
            ActionType.ResolveCitizenshipOffer
        )
        expect(() =>
            engine.runNext(buildAction(EndActPhase, { playerId: 'p1' }), state, game).updatedState
        ).toThrow()
    })

    it('a refusal is a real answer: nothing moves and the turn resumes (R-X.1)', () => {
        const game = testGame(['p1', 'p2'])
        let state = citizenshipTable()
        state = offerCitizenship(state, game, 'p1', 'p2')

        const before = structuredClone(state.players)
        state = engine.runNext(buildAction(ResolveCitizenshipOffer, {
            playerId: 'p2',
            granted: false
        }), state, game).updatedState

        expect(state.players[1].status).toBe(PlayerStatus.Exile)
        expect(state.players).toEqual(before)
        expect(state.reliquary).toHaveLength(1)
        expect(state.pendingConsent).toBeUndefined()
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('lets the offerer ask again after a refusal (R-4.2)', () => {
        const game = testGame(['p1', 'p2'])
        let state = citizenshipTable()
        state = offerCitizenship(state, game, 'p1', 'p2')
        state = engine.runNext(buildAction(ResolveCitizenshipOffer, {
            playerId: 'p2',
            granted: false
        }), state, game).updatedState
        state = offerCitizenship(state, game, 'p1', 'p2')
        expect(state.machineState).toBe(MachineState.ConsentRequest)
    })

    it('R-2.11-H1 — the title is re-evaluated after the answer, not just after the ask', () => {
        // R-6.6.2, R-6.6.3 — accepting turns p2's warbands purple, so p1 rules all three sites.
        const game = testGame(['p1', 'p2'])
        let state = buildState(
            {
                reliquary: [{ slotId: 'reliquary.0' }],
                vault: reliquaryVault(),
                oathType: OathType.Supremacy,
                oathkeeperPlayerId: 'p2',
                warbandsBySite: { c1: { purple: 1 }, c2: { red: 1 }, h1: { red: 1 } }
            },
            { p1: { relicIds: ['relic.grand-scepter'] } }
        )
        state = wake(state, game, 'p1')
        expect(state.oathkeeperPlayerId).toBe('p2')

        state = offerCitizenship(state, game, 'p1', 'p2')
        expect(state.oathkeeperPlayerId).toBe('p2')

        state = engine.runNext(buildAction(ResolveCitizenshipOffer, {
            playerId: 'p2',
            granted: true
        }), state, game).updatedState

        expect(state.oathkeeperPlayerId).toBe('p1')
        expect(state.pendingOathkeeperChoice).toBeUndefined()
        expect(state.machineState).toBe(MachineState.ActPhase)
    })

    it('refuses an answer from anybody but the asked player (R-X.1)', () => {
        const game = testGame(['p1', 'p2'])
        let state = citizenshipTable()
        state = offerCitizenship(state, game, 'p1', 'p2')

        expect(() =>
            engine.runNext(buildAction(ResolveCitizenshipOffer, {
                playerId: 'p1',
                granted: true
            }), state, game).updatedState
        ).toThrow(/not an active player/)
    })
})

describe('R-6.5.b — a warband move waits on the other player, through the engine', () => {
    function takeTable() {
        return buildState({}, {
            p2: { status: PlayerStatus.Citizen, siteId: 'c1', warbandsOnBoard: { purple: 2 } }
        })
    }

    function takeOne(state: OathProjectedState, game: Game) {
        return engine.runNext(buildAction(MoveWarbands, {
            playerId: 'p1',
            move: { kind: WarbandMoveKind.TakeFromImperial, otherPlayerId: 'p2' },
            color: Color.Purple,
            count: 1
        }), state, game).updatedState
    }

    it('puts the asked player on the clock and offers them the answer alone', () => {
        const game = testGame(['p1', 'p2'])
        const state = takeOne(wake(takeTable(), game, 'p1'), game)
        expect(state.machineState).toBe(MachineState.ConsentRequest)
        expect(state.activePlayerIds).toEqual(['p2'])
        expect(engine.getValidActionTypesForPlayer(game, state, 'p2')).toEqual([ActionType.AnswerConsent])
        expect(engine.getValidActionTypesForPlayer(game, state, 'p1')).toEqual([])
        expect(state.players[1].warbandsOnBoard).toEqual({ purple: 2 })
    })

    it('the answer carries the move out and hands the turn back', () => {
        const game = testGame(['p1', 'p2'])
        let state = takeOne(wake(takeTable(), game, 'p1'), game)
        state = engine.runNext(buildAction(AnswerConsent, { playerId: 'p2', granted: true }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(state.players[1].warbandsOnBoard).toEqual({ purple: 1 })
        expect(state.players[0].warbandsOnBoard).toEqual({ purple: 1 })
    })
})

describe('R-2.11.b — the choice interrupts the turn, through the engine', () => {
    function contested() {
        const game = testGame(['p1', 'p2'])
        const state = buildState({
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'p1',
            warbandsBySite: { c1: { purple: 1 } }
        })
        return { game, state }
    }

    it('does NOT open a choice when the move is forced — one candidate', () => {
        const { game, state: initial } = contested()
        let state = wake(initial, game, 'p1')
        expect(state.oathkeeperPlayerId).toBe('p1')

        state.warbandsBySite = { c2: { red: 1 }, p1: { red: 1 } }
        state = engine.runNext(buildAction(Muster, { playerId: 'p1', cardId: ORDER }), state, game).updatedState

        expect(state.pendingOathkeeperChoice).toBeUndefined()
        expect(state.oathkeeperPlayerId).toBe('p2')
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('opens the choice when two players tie and the holder drops out', () => {
        const game = testGame(['p1', 'p2', 'p3'])
        let state = buildState({
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'p1',
            warbandsBySite: { c1: { purple: 1 } }
        })
        const third = testPlayer({
            playerId: 'p3',
            color: Color.Yellow,
            status: PlayerStatus.Exile,
            siteId: 'p1',
            warbandsInPersonalBank: { [Color.Yellow]: 4 }
        })
        state.players = [...state.players, third]
        state.turnManager.turnOrder = ['p1', 'p2', 'p3']
        state.turnManager.turnCounts = { p1: 0, p2: 0, p3: 0 }

        state = wake(state, game, 'p1')
        expect(state.oathkeeperPlayerId).toBe('p1')

        state.warbandsBySite = { c2: { red: 1 }, p1: { yellow: 1 } }
        state = engine.runNext(buildAction(Muster, { playerId: 'p1', cardId: ORDER }), state, game).updatedState

        // R-2.11.b — the title stays put until the outgoing holder chooses.
        expect(state.oathkeeperPlayerId).toBe('p1')
        expect(state.machineState).toBe(MachineState.OathkeeperChoice)
        expect(state.pendingOathkeeperChoice?.holderPlayerId).toBe('p1')
        expect(state.pendingOathkeeperChoice?.candidates).toEqual(['p2', 'p3'])
        expect(state.activePlayerIds).toEqual(['p1'])
        expect(engine.getValidActionTypesForPlayer(game, state, 'p1')).toEqual([
            ActionType.ResolveOathkeeper
        ])

        state = engine.runNext(buildAction(ResolveOathkeeper, {
            playerId: 'p1',
            chosenPlayerId: 'p3'
        }), state, game).updatedState

        expect(state.oathkeeperPlayerId).toBe('p3')
        expect(state.oathkeeperIsUsurper).toBe(false)
        expect(state.pendingOathkeeperChoice).toBeUndefined()
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p1'])
    })

    it('refuses a choice naming a player who is not tied (R-X.1)', () => {
        const game = testGame(['p1', 'p2', 'p3'])
        let state = buildState({
            oathType: OathType.Supremacy,
            oathkeeperPlayerId: 'p1',
            warbandsBySite: { c1: { purple: 1 } }
        })
        state.players = [
            ...state.players,
            testPlayer({
                playerId: 'p3',
                color: Color.Yellow,
                status: PlayerStatus.Exile,
                siteId: 'p1',
                warbandsInPersonalBank: { [Color.Yellow]: 4 }
            })
        ]
        state.turnManager.turnOrder = ['p1', 'p2', 'p3']
        state.turnManager.turnCounts = { p1: 0, p2: 0, p3: 0 }

        state = wake(state, game, 'p1')
        state.warbandsBySite = { c2: { red: 1 }, p1: { yellow: 1 } }
        state = engine.runNext(buildAction(Muster, { playerId: 'p1', cardId: ORDER }), state, game).updatedState
        expect(state.machineState).toBe(MachineState.OathkeeperChoice)

        expect(() =>
            engine.runNext(buildAction(ResolveOathkeeper, {
                playerId: 'p1',
                chosenPlayerId: 'p1'
            }), state, game).updatedState
        ).toThrow(/not one of the tied players/)
    })
})

/** R-3.1, R-4.1.2, R-4.1.3 — the Usurper Win takes a full round. */
describe('a scripted full game reaches a correct Oathkeeper victory', () => {
    it('an Exile holding the People’s Favor wins as the Usurper, one round later', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState(
            {
                oathType: OathType.ThePeople,
                banners: testBanners({ [Banner.PeoplesFavor]: 'p2' })
            },
            { p2: { favor: 3 } }
        )

        state = wake(state, game, 'p1')
        expect(state.oathkeeperPlayerId).toBe('p2')
        expect(state.oathkeeperIsUsurper).toBe(false)
        state = engine.runNext(buildAction(Muster, { playerId: 'p1', cardId: ORDER }), state, game).updatedState
        state = endTurn(state, game, 'p1')

        // R-4.1.1 is mandatory: p2 holds the People's Favor.
        state = engine.runNext(buildAction(ResolveWake, {
            playerId: 'p2',
            favorSteps: [{ kind: 'place' }]
        }), state, game).updatedState
        expect(state.oathkeeperIsUsurper).toBe(true)
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.winningPlayerIds).toEqual([])

        state = endTurn(state, game, 'p2')
        expect(state.round).toBe(2)
        expect(state.machineState).toBe(MachineState.ActPhase)

        state = wake(state, game, 'p1')
        expect(state.winningPlayerIds).toEqual([])
        state = endTurn(state, game, 'p1')

        state = engine.runNext(buildAction(ResolveWake, {
            playerId: 'p2',
            favorSteps: [{ kind: 'place' }]
        }), state, game).updatedState

        expect(state.machineState).toBe(MachineState.EndOfGame)
        expect(state.winningPlayerIds).toEqual(['p2'])
        expect(state.result).toBe(GameResult.Win)
        expect(state.activePlayerIds).toEqual([])
    })
})

describe('R-4.1 — a Wake with nothing to decide resolves itself', () => {
    it('opens the next turn straight into its Act Phase, through a System ResolveWake', () => {
        const game = testGame(['p1', 'p2'])
        let state = wake(buildState(), game, 'p1')
        state = engine.runNext(buildAction(EndActPhase, { playerId: 'p1' }), state, game).updatedState

        const result = engine.run(
            action(buildAction(CompleteRest, { playerId: 'p1', index: state.actionCount })),
            state,
            game
        )
        const types = result.processedActions.map((a) => [a.type, a.source, a.playerId])
        expect(types).toEqual([
            [ActionType.CompleteRest, ActionSource.User, 'p1'],
            [ActionType.ResolveWake, ActionSource.System, 'p2']
        ])
        expect(result.updatedState.machineState).toBe(MachineState.ActPhase)
        expect(result.updatedState.activePlayerIds).toEqual(['p2'])
        expect(result.updatedState.turnManager.series).toHaveLength(2)
        // R-4.3.4 — the turn's opening stamps the baseline, before the Wake.
        expect(result.updatedState.players[1].supplyAtTurnStart).toBe(MAX_SUPPLY)
    })

    it('waits for the holder of the People’s Favor, who has a step to declare (R-4.1.1)', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState(
            { banners: testBanners({ [Banner.PeoplesFavor]: 'p2' }) },
            { p2: { favor: 2 } }
        )
        state = wake(state, game, 'p1')
        state = endTurn(state, game, 'p1')

        expect(state.machineState).toBe(MachineState.WakePhase)
        expect(state.activePlayerIds).toEqual(['p2'])
        expect(engine.getValidActionTypesForPlayer(game, state, 'p2')).toContain(
            ActionType.ResolveWake
        )
    })

    it('waits for a holder with no favor while the banner can still be returned (R-4.1.1-H1)', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState(
            { banners: testBanners({ [Banner.PeoplesFavor]: 'p2' }, 2) },
            { p2: { favor: 0 } }
        )
        state = wake(state, game, 'p1')
        state = endTurn(state, game, 'p1')
        expect(state.machineState).toBe(MachineState.WakePhase)
    })

    it('resolves for a holder with no favor and the banner at its floor (R-9.2.a)', () => {
        const game = testGame(['p1', 'p2'])
        let state = buildState(
            { banners: testBanners({ [Banner.PeoplesFavor]: 'p2' }, 1) },
            { p2: { favor: 0 } }
        )
        state = wake(state, game, 'p1')
        state = endTurn(state, game, 'p1')
        expect(state.machineState).toBe(MachineState.ActPhase)
        expect(state.activePlayerIds).toEqual(['p2'])
    })
})

describe('R-6.4-H1 — the Reliquary is the Scepter holder’s to know, with no Peek', () => {
    const RELIC_A = 'relic.unnamed-1'
    const RELIC_B = 'relic.unnamed-2'

    function scepterTable(reliquary: { slotId: string }[], peekedRelics: Record<string, string> = {}) {
        const vault = testVaultWithRelics({})
        vault.relicFacedown['reliquary.0'] = RELIC_A
        vault.relicFacedown['reliquary.1'] = RELIC_B
        return buildState({ reliquary, vault }, {
            p1: { relicIds: ['relic.grand-scepter'], peekedRelicSlotIds: Object.keys(peekedRelics), peekedRelics }
        })
    }

    it('after any action the holder knows every covered space, and learning it is an Undo barrier', () => {
        const game = testGame(['p1', 'p2'])
        const state = scepterTable([{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }])
        const result = engine.run(
            action(buildAction(ResolveWake, { playerId: 'p1', favorSteps: [], index: 0 })),
            state,
            game
        )
        expect(result.processedActions.map((a) => a.type)).toEqual([ActionType.ResolveWake])
        expect(result.processedActions[0].revealsInfo).toBe(true)
        expect(result.updatedState.players[0].peekedRelics).toEqual({ 'reliquary.0': RELIC_A, 'reliquary.1': RELIC_B })
        expect(result.updatedState.machineState).toBe(MachineState.ActPhase)
    })

    it('no Peek targets the Reliquary', () => {
        const game = testGame(['p1', 'p2'])
        const woke = engine.run(
            action(buildAction(ResolveWake, { playerId: 'p1', favorSteps: [], index: 0 })),
            scepterTable([{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }]),
            game
        )
        const s = new HydratedOathGameState(woke.updatedState)
        expect(HydratedPeek.legalTargets(s, 'p1').map((t) => t.slotId)).not.toContain('reliquary.0')
        expect(() =>
            engine.run(
                action(buildAction(Peek, { playerId: 'p1', target: { kind: PeekTargetKind.SiteRelic, slotId: 'reliquary.1' }, index: 1 })),
                woke.updatedState,
                game
            )
        ).toThrow('not a relic slot at any site')
    })

    it('a holder who already knows every space learns nothing, so the action is no barrier for it', () => {
        const game = testGame(['p1', 'p2'])
        const state = scepterTable([{ slotId: 'reliquary.0' }, { slotId: 'reliquary.1' }], { 'reliquary.0': RELIC_A, 'reliquary.1': RELIC_B })
        const result = engine.run(
            action(buildAction(ResolveWake, { playerId: 'p1', favorSteps: [], index: 0 })),
            state,
            game
        )
        expect(result.processedActions).toHaveLength(1)
        expect(result.processedActions[0].revealsInfo).toBe(false)
    })

    it('teaches nothing to a player without the Scepter', () => {
        const game = testGame(['p1', 'p2'])
        const vault = testVaultWithRelics({})
        vault.relicFacedown['reliquary.0'] = RELIC_A
        const state = buildState({ reliquary: [{ slotId: 'reliquary.0' }], vault })
        const result = engine.run(
            action(buildAction(ResolveWake, { playerId: 'p1', favorSteps: [], index: 0 })),
            state,
            game
        )
        expect(result.processedActions).toHaveLength(1)
        expect(result.updatedState.reliquary).toEqual([{ slotId: 'reliquary.0' }])
        expect(result.updatedState.players[0].peekedRelics).toEqual({})
    })
})
