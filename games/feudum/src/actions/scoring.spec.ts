import {
    ActionSource,
    assertExists,
    GameResult,
    Visibility,
    validateGameResult
} from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { SpaceId } from '../data/board.js'
import { Spaces } from '../data/board.js'
import type { LocationKind } from '../data/discs.js'
import { FeudumDiscs } from '../data/discs.js'
import { LastEpoch } from '../data/tracks.js'
import { Charters, Mandates, type CharterId } from '../data/writs.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { ActionType } from '../definition/actions.js'
import { FeudumRuntime } from '../definition/runtime.js'
import { largeEmpireSets } from '../model/finalScoring.js'
import { FeudumGameState, HydratedFeudumGameState } from '../model/gameState.js'
import { holdSealedCharter } from '../testing/atWill.js'
import { meetCharter, ruleSpaces, setBarrel } from '../testing/charters.js'
import { buildFeudum, holdWrit } from '../testing/combat.js'
import { placeLandscape, playToDawn } from '../testing/dawn.js'
import { rowOf, scoredIn, scoreFrom } from '../testing/gameEnd.js'
import { recordedText, setShillings } from '../testing/guilds.js'
import { giveSeal, spaceOfKind } from '../testing/improving.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { HydratedScoreGame } from './scoreGame.js'

const Barrel: CharterId = 'writ.charter.sulfur-barrel'
const Monster: CharterId = 'writ.charter.monster-defeat'

const spectator = { kind: 'spectator' } as const

/** R-4.1.4 This seat rules one space of each kind named, on the board as it stands. */
function ruleKinds(
    state: HydratedFeudumGameState,
    playerId: string,
    kinds: readonly LocationKind[]
): void {
    const taken: SpaceId[] = []
    for (const kind of kinds) {
        const spaceId = spaceOfKind(state, kind, taken)
        taken.push(spaceId)
    }
    ruleSpaces(state, playerId, taken)
}

describe('R-6.2 epic voyage', () => {
    it.each([
        { spaces: [1], vps: [5], why: 'the only disc in a section leads it' },
        { spaces: [2, 1], vps: [5, 3], why: 'the leader takes the higher, the other the lower' },
        { spaces: [2, 2], vps: [5, 5], why: 'tied on the further space, both take the higher' },
        { spaces: [1, 1], vps: [5, 5], why: 'tied on the nearer space, both take the higher' },
        { spaces: [3, 2], vps: [9, 5], why: 'each section is scored apart' },
        { spaces: [4, 3], vps: [9, 7], why: 'the second section' },
        { spaces: [6, 5], vps: [13, 11], why: 'the third section' },
        { spaces: [7, 6], vps: [17, 13], why: 'the monastery is its own section' },
        { spaces: [7, 7], vps: [17, 17], why: 'every disc at the monastery takes 17' }
    ])('R-6.2 at $spaces: $vps, $why', ({ spaces, vps }) => {
        const { metadata, order } = scoreFrom((state, seats) => {
            spaces.forEach((space, index) => {
                state.voyageTrack[seats[index]] = `track.voyage.${space}`
            })
        })

        spaces.forEach((space, index) => {
            expect(rowOf(metadata, order[index]).voyage).toEqual({
                space: `track.voyage.${space}`,
                vp: vps[index]
            })
        })
    })

    it('R-6.2 a seat with no disc on the track scores nothing for it', () => {
        const { metadata, order } = scoreFrom((state, [other]) => {
            state.voyageTrack[other] = 'track.voyage.1'
        })

        expect(rowOf(metadata, order[1]).voyage).toEqual({ vp: 0 })
    })
})

describe('R-6.2 large empires', () => {
    it.each<{ kinds: LocationKind[]; sets: number }>([
        { kinds: [], sets: 0 },
        { kinds: ['outpost', 'farm', 'town'], sets: 0 },
        { kinds: ['outpost', 'outpost'], sets: 0 },
        { kinds: ['outpost', 'outpost', 'outpost'], sets: 1 },
        { kinds: ['farm', 'farm', 'farm', 'farm', 'farm', 'farm'], sets: 2 },
        { kinds: ['town', 'town', 'feudum'], sets: 1 },
        { kinds: ['town', 'feudum', 'feudum'], sets: 1 },
        { kinds: ['feudum', 'feudum', 'feudum'], sets: 1 },
        { kinds: ['outpost', 'outpost', 'outpost', 'feudum'], sets: 1 },
        { kinds: ['outpost', 'outpost', 'farm', 'farm', 'feudum'], sets: 1 },
        { kinds: ['outpost', 'outpost', 'farm', 'farm', 'feudum', 'feudum'], sets: 2 },
        { kinds: ['outpost', 'farm', 'farm', 'feudum', 'feudum'], sets: 1 },
        { kinds: ['outpost', 'farm', 'farm', 'feudum', 'feudum', 'feudum'], sets: 2 },
        { kinds: ['outpost', 'farm', 'town', 'feudum', 'feudum'], sets: 1 },
        { kinds: ['outpost', 'feudum', 'feudum', 'feudum', 'feudum'], sets: 1 },
        { kinds: ['outpost', 'feudum', 'feudum', 'feudum', 'feudum', 'feudum'], sets: 2 },
        { kinds: ['feudum', 'feudum', 'feudum', 'feudum', 'feudum', 'feudum'], sets: 2 }
    ])('R-6.2-H3 $kinds make $sets', ({ kinds, sets }) => {
        expect(largeEmpireSets(kinds)).toBe(sets)
    })

    it('R-6.2 1 vp per outpost, farm or town; 3 per feudum; +3 per set', () => {
        const { metadata, order } = scoreFrom((state, [ruler]) => {
            ruleKinds(state, ruler, ['outpost', 'outpost', 'farm', 'town'])
            const feudumSpace = Spaces.map(({ id }) => id).find(
                (id) => state.spaces[id].ruler === undefined
            )
            assertExists(feudumSpace, 'A space is free')
            buildFeudum(state, ruler, feudumSpace, FeudumDiscs[0].id, FeudumDiscs[0].guild)
        })

        expect(rowOf(metadata, order[0]).largeEmpire).toEqual({
            outposts: 2,
            farms: 1,
            towns: 1,
            feudums: 1,
            sets: 1,
            vp: 4 + 3 + 3
        })
    })

    it('R-6.2 only what the seat rules counts: a serf on it scores its ruler', () => {
        const { metadata, order } = scoreFrom((state, [ruler, serf]) => {
            placeLandscape(state, { rulerId: ruler, serfId: serf })
        })

        expect(rowOf(metadata, order[0]).largeEmpire.farms).toBe(1)
        expect(rowOf(metadata, order[1]).largeEmpire.farms).toBe(0)
    })
})

describe('R-6.2 shillings', () => {
    it.each([
        { held: 0, vp: 0 },
        { held: 2, vp: 0 },
        { held: 3, vp: 1 },
        { held: 8, vp: 2 },
        { held: 9, vp: 3 }
    ])('R-6.2 $held shillings: $vp vp', ({ held, vp }) => {
        const { metadata, order } = scoreFrom((state, [seat]) => {
            setShillings(state, seat, held)
        })

        expect(rowOf(metadata, order[0]).shillings).toEqual({ held, vp })
    })
})

describe('R-4.4.3, R-4.4-H6 at game end each held seal goes on a held charter', () => {
    it('R-4.4.3 one seal goes on the best charter held, which scores; the other stays hidden', () => {
        const { table, metadata, order, action } = scoreFrom((state, [holder]) => {
            holdWrit(state, holder, Barrel)
            holdWrit(state, holder, Monster)
            meetCharter(state, holder, Monster)
            giveSeal(state, holder)
        })

        expect(rowOf(metadata, order[0]).charters).toEqual([{ writId: Monster, vp: 7 }])
        expect(recordedText(action)).not.toContain(Barrel)
        const seat = table.hydrated().getPlayerState(order[0])
        expect(seat.sealCount).toBe(0)
        expect(seat.requireSealedCharters()).toEqual([Monster])
        expect(seat.requireWrits()).toEqual([Barrel])
    })

    it('R-4.4.3 one seal a charter: three seals on two charters seal both, and one stays held', () => {
        const { table, metadata, order } = scoreFrom((state, [holder]) => {
            holdWrit(state, holder, Barrel)
            holdWrit(state, holder, Monster)
            meetCharter(state, holder, Monster)
            for (let times = 0; times < 3; times += 1) {
                giveSeal(state, holder)
            }
        })

        expect(rowOf(metadata, order[0]).charters).toEqual([
            { writId: Monster, vp: 7 },
            { writId: Barrel, vp: 0 }
        ])
        expect(table.hydrated().getPlayerState(order[0]).sealCount).toBe(1)
    })
})

describe('R-6.2, R-4.4.3 sealed charters', () => {
    it('R-6.2 a sealed charter met pays as printed, and is revealed in the row', () => {
        const { metadata, order } = scoreFrom((state, [holder]) => {
            holdSealedCharter(state, holder, Monster)
            meetCharter(state, holder, Monster)
        })

        expect(rowOf(metadata, order[0]).charters).toEqual([{ writId: Monster, vp: 7 }])
    })

    it('R-6.2 a sealed charter not met is still revealed, at 0', () => {
        const { metadata, order } = scoreFrom((state, [holder]) => {
            holdSealedCharter(state, holder, Monster)
        })

        expect(rowOf(metadata, order[0]).charters).toEqual([{ writId: Monster, vp: 0 }])
    })

    it('R-4.4.3 a charter met but unsealed scores nothing and stays hidden', () => {
        const { metadata, order, action } = scoreFrom((state, [holder]) => {
            holdWrit(state, holder, Monster)
            meetCharter(state, holder, Monster)
        })

        expect(rowOf(metadata, order[0]).charters).toEqual([])
        expect(recordedText(action)).not.toContain(Monster)
    })

    it('R-4.4.3 a mandate in hand scores nothing', () => {
        const writId = Mandates[0].id
        const { metadata, order, action } = scoreFrom((state, [holder]) => {
            holdWrit(state, holder, writId)
        })

        expect(rowOf(metadata, order[0]).charters).toEqual([])
        expect(recordedText(action)).not.toContain(writId)
    })

    it('R-6.2-H2 a wine-fed pawn’s sulfur has left the barrel, for the charter and the tie', () => {
        const { processed, order, table } = playToDawn(5, (state, [holder]) => {
            holdWrit(state, holder, Barrel)
            giveSeal(state, holder)
            setBarrel(state, holder, 3)
            const { goods } = state.getPlayerState(holder)
            state.supply.haversack.food += goods.food
            goods.food = 0
        })

        const wineFed = table.seat(order[0]).pawns.filter((pawn) => pawn.wine === 'fed').length
        expect(wineFed).toBeGreaterThan(0)
        expect(table.seat(order[0]).barrel).toBe(3 - wineFed)
        const paid = Charters.find(({ id }) => id === Barrel)
        const expected =
            paid?.kind === 'sulfur-barrel'
                ? (paid.vpBySulfur.find(({ sulfur }) => sulfur === 3 - wineFed)?.vp ?? 0)
                : undefined
        expect(rowOf(scoredIn(processed), order[0]).charters).toEqual([
            { writId: Barrel, vp: expected }
        ])
    })

    it('R-4.4.3 a table’s charters are all revealed, seat by seat, to everyone', () => {
        const { action, order } = scoreFrom((state, [first, second]) => {
            holdSealedCharter(state, first, Monster)
            holdSealedCharter(state, second, Barrel)
        })

        const projector = Visibility.createActionProjector(FeudumApiActions)
        for (const perspective of [spectator, { kind: 'player', playerId: order[2] } as const]) {
            const projected = projector.project(action, perspective, { config: {} })
            expect(projected).toMatchObject({
                type: ActionType.ScoreGame,
                metadata: {
                    sheet: expect.arrayContaining([
                        expect.objectContaining({
                            playerId: order[0],
                            charters: [{ writId: Monster, vp: 0 }]
                        }),
                        expect.objectContaining({
                            playerId: order[1],
                            charters: [{ writId: Barrel, vp: 0 }]
                        })
                    ])
                }
            })
        }
    })

    it('R-5-H1 scoring reads the seats’ sealed charters, not the vault', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
        table.moveTo((state) => {
            holdSealedCharter(state, table.order[0], Monster)
            state.epoch = LastEpoch
            return state.machineState
        })
        const state = table.hydrated()
        state.vault = undefined
        const action = new HydratedScoreGame({
            id: 'score',
            gameId: table.game.id,
            type: ActionType.ScoreGame,
            source: ActionSource.System,
            revealsInfo: true
        })

        action.apply(state)

        expect(action.metadata?.sheet.flatMap((row) => row.charters)).toEqual([
            { writId: Monster, vp: 0 }
        ])
    })

    it('R-X.2 a projection cannot score: another seat’s charters are for the host to reveal', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
        const projector = Visibility.createProjector(FeudumGameState)
        const projected = projector.project(canonicalOf(table.hydrated()), spectator, {
            config: {}
        })
        const action = new HydratedScoreGame({
            id: 'score',
            gameId: table.game.id,
            type: ActionType.ScoreGame,
            source: ActionSource.System,
            revealsInfo: true
        })

        expect(() => action.apply(new HydratedFeudumGameState(projected))).toThrow('owner-known')
    })
})

describe('R-6.3 the winner', () => {
    function tied(
        scores: readonly number[],
        barrels: readonly number[] = scores.map(() => 0)
    ): ReturnType<typeof scoreFrom> {
        return scoreFrom((state, seats) => {
            seats.forEach((seat, index) => {
                state.getPlayerState(seat).score = scores[index]
                setBarrel(state, seat, barrels[index])
            })
        })
    }

    it('R-6.3 most vp wins, whatever the barrels hold', () => {
        const { table, metadata, order } = tied([20, 10, 5], [0, 3, 3])

        expect(table.state.result).toBe(GameResult.Win)
        expect(table.state.winningPlayerIds).toEqual([order[0]])
        expect(metadata.winners).toEqual([order[0]])
        expect(metadata).not.toHaveProperty('barrelTieBreak')
    })

    it('R-6.3 tied on vp, most sulfur in the barrel wins, and the row records it', () => {
        const { table, metadata, order } = tied([20, 20, 5], [1, 2, 3])

        expect(table.state.result).toBe(GameResult.Win)
        expect(table.state.winningPlayerIds).toEqual([order[1]])
        expect(metadata.barrelTieBreak).toEqual(
            expect.arrayContaining([
                { playerId: order[0], barrel: 1 },
                { playerId: order[1], barrel: 2 }
            ])
        )
        expect(metadata.barrelTieBreak).toHaveLength(2)
    })

    it('R-6.3 still tied, the seats share it as a draw', () => {
        const { table, metadata, order } = tied([20, 20, 5], [2, 2, 3])

        expect(table.state.result).toBe(GameResult.Draw)
        expect(table.state.winningPlayerIds.toSorted()).toEqual([order[0], order[1]].toSorted())
        expect(metadata.winners.toSorted()).toEqual([order[0], order[1]].toSorted())
        expect(() => validateGameResult(table.state)).not.toThrow()
    })

    it('R-6.3 every seat tied on everything shares it', () => {
        const { table, order } = tied([7, 7, 7], [1, 1, 1])

        expect(table.state.result).toBe(GameResult.Draw)
        expect(table.state.winningPlayerIds.toSorted()).toEqual([...order].toSorted())
    })

    it('R-6.3 the win is decided on the scores after final scoring', () => {
        const { table, order } = scoreFrom((state, [behind, ahead]) => {
            state.getPlayerState(behind).score = 10
            state.getPlayerState(ahead).score = 11
            state.voyageTrack[behind] = 'track.voyage.7'
        })

        expect(table.state.winningPlayerIds).toEqual([order[0]])
    })
})

describe('R-6.2, S56 the final sheet', () => {
    it('R-6.2 a seat’s total is its parts, added to its score', () => {
        const { table, metadata, order } = scoreFrom((state, [seat]) => {
            state.getPlayerState(seat).score = 30
            state.voyageTrack[seat] = 'track.voyage.3'
            setShillings(state, seat, 7)
            holdSealedCharter(state, seat, Monster)
            meetCharter(state, seat, Monster)
        })

        const row = rowOf(metadata, order[0])
        const { voyage, largeEmpire, shillings, charters } = row
        expect(row.total).toBe(
            voyage.vp +
                largeEmpire.vp +
                shillings.vp +
                charters.reduce((sum, { vp }) => sum + vp, 0)
        )
        expect(row.score).toBe(30 + row.total)
        expect(table.seat(order[0]).score).toBe(row.score)
    })

    it('R-6.2 there is a row for every seat, in turn order', () => {
        const { metadata, table } = scoreFrom(() => undefined, 4)

        expect(metadata.sheet.map(({ playerId }) => playerId)).toEqual(table.order)
    })

    it('R-6.2 the platform’s final scores are the seats’ scores, not a tie-break', () => {
        const { table, order, metadata } = scoreFrom((state, seats) => {
            seats.forEach((seat, index) => {
                state.getPlayerState(seat).score = 10 * index
                setBarrel(state, seat, 3 - index)
            })
        })

        expect(FeudumRuntime.scoring.finalScores(table.state)).toEqual(
            Object.fromEntries(order.map((seat) => [seat, rowOf(metadata, seat).score]))
        )
    })
})
