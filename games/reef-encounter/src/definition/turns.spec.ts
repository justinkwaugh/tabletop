import { assert, GameResult, validateGameResult, Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { CoralColor, CoralColors, coralCounts, totalCount } from '../components/colors.js'
import { isRefillOpenSea } from '../actions/refillOpenSea.js'
import { coralValues } from '../model/scoring.js'
import {
    GameEndReason,
    ReefEncounterGameStateValidator,
    type ReefEncounterProjectedState
} from '../model/gameState.js'
import { completeSetup, startTestGame, type TestSession } from '../util/testHelper.js'
import { ReefEncounterRuntime } from './runtime.js'
import { MachineState } from './states.js'

function startPlaying(playerCount = 3) {
    const session = startTestGame(playerCount)
    completeSetup(session)
    return session
}

function space(state: ReefEncounterProjectedState, larvaColor: CoralColor) {
    const found = state.openSea.find((candidate) => candidate.larvaColor === larvaColor)
    assert(found, `No ${larvaColor} space`)
    return found
}

function project(session: TestSession, perspective: Visibility.Perspective) {
    assert(
        ReefEncounterGameStateValidator.Check(session.state),
        'Projection starts from canonical state'
    )
    return ReefEncounterRuntime.visibility.state.project(session.state, perspective, {
        config: session.game.config
    })
}

function emptyBagBut(session: TestSession, polyps: CoralColor[]) {
    session.edit((draft) => {
        draft.polypBag = { items: polyps, remaining: polyps.length }
    })
}

describe('taking an open-sea space', () => {
    it('puts the larva cube and its polyps in the supply as known polyps', () => {
        const session = startPlaying()
        const playerId = session.currentPlayerId()
        const taken = [...space(session.state, CoralColor.White).polyps]
        const before = session.hydrated().getPlayerState(playerId)
        const cubesBefore = before.getLarvaCubes()[CoralColor.White]

        session.takeOpenSeaSpace(playerId, CoralColor.White)

        const player = session.hydrated().getPlayerState(playerId)
        expect(player.getLarvaCubes()[CoralColor.White]).toBe(cubesBefore + 1)
        expect(totalCount(player.getKnownSupplyPolyps())).toBe(taken.length)
        for (const color of taken) {
            expect(player.getKnownSupplyPolyps()[color]).toBeGreaterThan(0)
        }
    })

    it('refills the open sea and passes the turn clockwise', () => {
        const session = startPlaying()
        const [first, second, third] = session.state.turnManager.turnOrder
        const short = session.state.openSea.filter(
            (candidate) => candidate.polyps.length < 3
        ).length
        const bagBefore = session.state.polypBag.remaining
        const supplyBefore = session.state.larvaCubeSupply[CoralColor.Yellow]

        session.takeOpenSeaSpace(first, CoralColor.Yellow)

        const yellow = space(session.state, CoralColor.Yellow)
        expect(yellow.hasLarvaCube).toBe(true)
        expect(yellow.polyps).toHaveLength(1)
        expect(session.state.larvaCubeSupply[CoralColor.Yellow]).toBe(supplyBefore - 1)
        expect(session.state.polypBag.remaining).toBe(bagBefore - short - 1)
        expect(session.state.machineState).toBe(MachineState.TakingTurn)
        expect(session.state.activePlayerIds).toEqual([second])

        session.takeOpenSeaSpace(second, CoralColor.White)
        session.takeOpenSeaSpace(third, CoralColor.White)
        expect(session.state.activePlayerIds).toEqual([first])
    })

    it('records the refill as a reveal, so Undo cannot cross it', () => {
        const session = startPlaying()
        const [, refill] = session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.Grey)

        assert(isRefillOpenSea(refill), 'The take is followed by a refill')
        expect(refill.revealsInfo).toBe(true)
        expect(refill.metadata?.larvaColor).toBe(CoralColor.Grey)
        expect(refill.metadata?.additions.map((addition) => addition.larvaColor)).toContain(
            CoralColor.Grey
        )
    })

    it('rejects a turn out of order', () => {
        const session = startPlaying()
        const [, second] = session.state.turnManager.turnOrder
        expect(() => session.takeOpenSeaSpace(second, CoralColor.White)).toThrow()
    })
})

describe('running the bag dry', () => {
    it('puts the bonus polyps into the bag when it runs out', () => {
        const session = startPlaying()
        emptyBagBut(session, [CoralColor.Orange])

        session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.White)

        expect(session.state.bonusPolyps).toEqual(coralCounts(0))
        expect(session.state.bonusPolypsInBag).toBe(true)
        expect(session.state.machineState).toBe(MachineState.TakingTurn)
        const added = session.state.openSea.reduce(
            (total, candidate) => total + candidate.polyps.length,
            0
        )
        expect(added + session.state.polypBag.remaining).toBeGreaterThan(0)
    })

    it('ends the game at once when there are too few polyps to refill', () => {
        const session = startPlaying()
        emptyBagBut(session, [])
        session.edit((draft) => {
            draft.bonusPolyps = coralCounts(0)
        })
        const openSeaBefore = structuredClone(session.state.openSea)

        session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.White)

        expect(session.state.machineState).toBe(MachineState.EndOfGame)
        expect(session.state.endReason).toBe(GameEndReason.Shortage)
        expect(session.state.activePlayerIds).toEqual([])
        const white = space(session.state, CoralColor.White)
        expect(white.hasLarvaCube).toBe(false)
        expect(
            session.state.openSea.filter((candidate) => candidate.larvaColor !== CoralColor.White)
        ).toEqual(openSeaBefore.filter((candidate) => candidate.larvaColor !== CoralColor.White))
    })

    it('ends the game at once when the taken larva cube cannot be replaced', () => {
        const session = startPlaying()
        session.edit((draft) => {
            draft.larvaCubeSupply[CoralColor.Orange] = 0
        })

        session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.Orange)

        expect(session.state.machineState).toBe(MachineState.EndOfGame)
    })
})

describe('scoring', () => {
    it('values each colour at 1 plus the coral tiles showing it stronger, 15 in all', () => {
        const values = coralValues(startPlaying().state.coralTiles)
        expect(CoralColors.reduce((total, color) => total + values[color], 0)).toBe(15)
        expect(Object.values(values).every((value) => value >= 1 && value <= 5)).toBe(true)
    })

    function endGameWith(
        session: TestSession,
        change: (draft: ReefEncounterProjectedState) => void
    ) {
        session.edit((draft) => {
            change(draft)
            draft.larvaCubeSupply[CoralColor.Orange] = 0
        })
        expect(session.currentPlayerId()).toBe(session.state.players[0].playerId)
        session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.Orange)
        expect(session.state.machineState).toBe(MachineState.EndOfGame)
    }

    // The player who ends the game takes the orange cube; match it and leave no polyps to take.
    function evenOutTheEndingTake(draft: ReefEncounterProjectedState) {
        const orange = draft.openSea.find((candidate) => candidate.larvaColor === CoralColor.Orange)
        assert(orange, 'The open sea has an orange space')
        orange.polyps = []
        draft.players[1].larvaCubes = { ...coralCounts(0), [CoralColor.Orange]: 1 }
    }

    function setParrotfish(draft: ReefEncounterProjectedState, seat: number, color: CoralColor) {
        draft.players[seat].secretParrotfishPolyps = { ...coralCounts(0), [color]: 1 }
    }

    it('declares the player whose parrotfish polyps are worth most the winner', () => {
        const session = startPlaying(2)
        session.edit((draft) => {
            const tile = draft.coralTiles[0]
            tile.starfishSideUp = !tile.starfishSideUp
        })
        const values = coralValues(session.state.coralTiles)
        const [best, worst] = [...CoralColors].sort((a, b) => values[b] - values[a])
        assert(values[best] > values[worst], 'Flipping one tile makes the coral values differ')
        const winner = session.state.players[1].playerId

        endGameWith(session, (draft) => {
            setParrotfish(draft, 0, worst)
            setParrotfish(draft, 1, best)
        })

        expect(session.state.result).toBe(GameResult.Win)
        expect(session.state.winningPlayerIds).toEqual([winner])
        expect(() => validateGameResult(session.state)).not.toThrow()
        const scoring = ReefEncounterRuntime.scoring
        expect(scoring.finalScores(session.state)).toEqual({
            [session.state.players[0].playerId]: values[worst],
            [winner]: values[best]
        })
    })

    it('breaks a tie by unplayed larva cubes, then unplayed supply polyps', () => {
        const byCubes = startPlaying(2)
        endGameWith(byCubes, (draft) => {
            setParrotfish(draft, 0, CoralColor.Grey)
            setParrotfish(draft, 1, CoralColor.Grey)
            draft.players[1].larvaCubes = { ...coralCounts(0), [CoralColor.Pink]: 5 }
        })
        expect(byCubes.state.winningPlayerIds).toEqual([byCubes.state.players[1].playerId])

        const byPolyps = startPlaying(2)
        endGameWith(byPolyps, (draft) => {
            for (const player of draft.players) {
                player.secretParrotfishPolyps = { ...coralCounts(0), [CoralColor.Grey]: 1 }
                player.larvaCubes = coralCounts(0)
                player.knownSupplyPolyps = coralCounts(0)
                player.secretSupplyPolyps = coralCounts(0)
                player.secretSupplyPolypCount = 0
            }
            draft.players[0].secretSupplyPolyps = { ...coralCounts(0), [CoralColor.White]: 2 }
            draft.players[0].secretSupplyPolypCount = 2
            evenOutTheEndingTake(draft)
        })
        expect(byPolyps.state.winningPlayerIds).toEqual([byPolyps.state.players[0].playerId])
    })

    it('shares the win when every tie-break is equal', () => {
        const session = startPlaying(2)
        endGameWith(session, (draft) => {
            for (const player of draft.players) {
                player.secretParrotfishPolyps = { ...coralCounts(0), [CoralColor.Grey]: 1 }
                player.larvaCubes = coralCounts(0)
                player.knownSupplyPolyps = coralCounts(0)
                player.secretSupplyPolyps = coralCounts(0)
                player.secretSupplyPolypCount = 0
            }
            evenOutTheEndingTake(draft)
        })

        expect(session.state.result).toBe(GameResult.Draw)
        expect(session.state.winningPlayerIds).toHaveLength(2)
        expect(() => validateGameResult(session.state)).not.toThrow()
    })
})

describe('the end of the game', () => {
    it('reveals every hidden fact to everyone, even when Concealed', () => {
        const session = startTestGame(3, { concealed: true })
        completeSetup(session)
        session.edit((draft) => {
            draft.larvaCubeSupply[CoralColor.Orange] = 0
        })
        session.takeOpenSeaSpace(session.currentPlayerId(), CoralColor.Orange)
        expect(session.state.machineState).toBe(MachineState.EndOfGame)

        for (const perspective of [
            { kind: 'spectator' } as const,
            { kind: 'player', playerId: session.state.players[0].playerId } as const
        ]) {
            for (const player of project(session, perspective).players) {
                expect(player.secretSupplyPolyps).toBeDefined()
                expect(player.secretParrotfishPolyps).toBeDefined()
                expect(player.knownSupplyPolyps).toBeDefined()
                expect(player.larvaCubes).toBeDefined()
                expect(player.shrimpsInSupply).toBeDefined()
            }
            expect(project(session, perspective).polypBag.items).toEqual([])
        }
    })
})
