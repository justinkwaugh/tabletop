import { assertExists, GameResult, MachineContext, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { CharterId } from '../data/writs.js'
import { RegionIds } from '../data/regionTiles.js'
import { LastEpoch, MilitaryServiceTrack } from '../data/tracks.js'
import { ActionType } from '../definition/actions.js'
import { FeudumRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import { removeTopTile } from '../model/regionStacks.js'
import { giveSeal } from '../testing/improving.js'
import { meetCharter } from '../testing/charters.js'
import { buildFeudum, holdWrit } from '../testing/combat.js'
import { placeLandscape, playToDawn } from '../testing/dawn.js'
import { rowOf, scoredIn } from '../testing/gameEnd.js'
import { recordedText } from '../testing/guilds.js'
import { coverService } from '../testing/state.js'
import { playOutCards, showOnStacks, typesOf } from '../testing/roundEnd.js'
import { tableAtPlayingCards } from '../testing/table.js'
import { isBeginDawn } from './beginDawn.js'
import { isEndRound } from './endRound.js'
import { isNourishPawns } from './nourishPawns.js'
import { isRollProgressDie } from './rollProgressDie.js'

const TheEnd = [ActionType.ScoreGame]

function metOnStacksAtEpochIV() {
    const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
    table.moveTo((state) => {
        showOnStacks(state, ['V', 4, 4, 4, 4, 4])
        state.epoch = 4
        return MachineState.PlayingCards
    })
    return table
}

describe('R-6.1, R-6.1-H1 once the condition for V is met', () => {
    it('R-6.1-H1 met during a round, the remaining cards are still played', () => {
        const table = metOnStacksAtEpochIV()
        const [first, second] = table.order
        const kind = table.seat(first).hand?.[0]
        assertExists(kind, 'R-3.2 The seat holds a card')

        table.send(first, { type: ActionType.ForfeitCard, kind })

        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(second)
        expect(table.state.result).toBeUndefined()
        expect(table.state.flow.epochTriggered).toBeUndefined()
        expect(table.state.epoch).toBe(4)
    })

    it('R-6.1-H1 met before step 3: nourished, no roll, the dawn, then final scoring', () => {
        const { table, processed } = playToDawn(5)

        expect(typesOf(processed)).toEqual([
            ActionType.ForfeitCard,
            ActionType.AdvanceTurn,
            ActionType.NourishPawns,
            ActionType.RollProgressDie,
            ActionType.BeginDawn,
            ...TheEnd
        ])
        const roll = processed.find((action) => isRollProgressDie(action))
        expect(roll?.metadata?.faces).toEqual([])
        expect(roll?.revealsInfo).toBeFalsy()
        expect(table.state.epoch).toBe(LastEpoch)
        expect(table.state.machineState).toBe(MachineState.EndOfGame)
    })

    it('R-6.1 pawns are nourished before the end: an unfed pawn scores no rank at the V dawn', () => {
        const { table, processed, order } = playToDawn(5, (state, [starved]) => {
            const { goods } = state.getPlayerState(starved)
            state.supply.haversack.food += goods.food
            goods.food = 0
        })
        const [starved, fed] = order

        const nourish = processed.find((action) => isNourishPawns(action))
        expect(nourish?.metadata?.fed).toContainEqual(expect.objectContaining({ playerId: fed }))
        expect(table.seat(starved).pawns.every((pawn) => pawn.spaceId === undefined)).toBe(true)
        const dawn = processed.find((action) => isBeginDawn(action))
        const row = dawn?.metadata?.sheet.find((entry) => entry.playerId === starved)
        expect(row?.ranks).toEqual([])
    })

    it('R-6.1 the die itself can meet it: the roll reveals, then the dawn and final scoring', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
        table.moveTo((state) => {
            for (const region of RegionIds) {
                while (state.regionStacks[region].length > 1) {
                    removeTopTile(state, region)
                }
            }
            state.epoch = 4
            return MachineState.PlayingCards
        })

        const processed = playOutCards(table)

        const roll = processed.find((action) => isRollProgressDie(action))
        expect(roll?.metadata?.epochTriggered).toBe(LastEpoch)
        expect(roll?.revealsInfo).toBe(true)
        expect(typesOf(processed).slice(-2)).toEqual([ActionType.BeginDawn, ...TheEnd])
        expect(table.state.machineState).toBe(MachineState.EndOfGame)
    })
})

describe('R-6.1, R-4.12 the V dawn', () => {
    const Penalties = MilitaryServiceTrack.map(({ penalty }) => penalty)

    it.each([
        { covered: 0, vp: Penalties[0] + Penalties[1] + Penalties[2] },
        { covered: 1, vp: Penalties[1] + Penalties[2] },
        { covered: 2, vp: Penalties[2] },
        { covered: 3, vp: 0 }
    ])('R-4.9.2 a vassal with $covered covered loses $vp, space 3 now due', ({ covered, vp }) => {
        const { processed, order } = playToDawn(5, (state, [vassal]) => {
            buildFeudum(state, vassal)
            coverService(state, vassal, covered)
        })

        const dawn = processed.find((action) => isBeginDawn(action))
        const row = dawn?.metadata?.sheet.find((entry) => entry.playerId === order[0])
        expect(row?.disloyaltyVp).toBe(vp)
    })

    it('R-6.1 the dawn scores and fills in full, and neither the map nor the guilds replenish', () => {
        const { table, processed, order } = playToDawn(5, (state, [ruler]) => {
            placeLandscape(state, { rulerId: ruler })
        })

        const types = typesOf(processed)
        expect(types).not.toContain(ActionType.ReplenishMap)
        expect(types).not.toContain(ActionType.ReplenishGuilds)
        const dawn = processed.find((action) => isBeginDawn(action))
        expect(dawn?.metadata?.fills).toHaveLength(1)
        const dawnRow = dawn?.metadata?.sheet.find((entry) => entry.playerId === order[0])
        assertExists(dawnRow, 'R-4.12.1 The seat has a row')
        const finalRow = rowOf(scoredIn(processed), order[0])
        expect(finalRow.score).toBe(dawnRow.total + finalRow.total)
        expect(table.seat(order[0]).score).toBe(finalRow.score)
    })

    it('R-4.12.3 a serf collects at V before final scoring', () => {
        let tended
        const { table, order } = playToDawn(5, (state, [ruler, serf]) => {
            tended = placeLandscape(state, { rulerId: ruler, serfId: serf })
        })
        assertExists(tended, 'The landscape was placed')

        expect(table.state.machineState).toBe(MachineState.CollectingLandscapes)
        expect(table.state.result).toBeUndefined()
        const after = table.send(order[1], {
            type: ActionType.CollectLandscapes,
            spaceIds: [tended]
        })

        expect(typesOf(after)).toEqual([ActionType.CollectLandscapes, ...TheEnd])
        expect(table.state.machineState).toBe(MachineState.EndOfGame)
    })

    it('R-6.1-H2 final scoring replaces the round’s end: the marker, pouch goods and cards stay', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move'], pouchGood: 'saltpeter' }), 3)
        const [first] = table.order
        table.moveTo((state) => {
            showOnStacks(state, ['V', 4, 4, 4, 4, 4])
            state.epoch = 4
            return MachineState.PlayingCards
        })

        const processed = playOutCards(table)

        expect(processed.some((action) => isEndRound(action))).toBe(false)
        expect(typesOf(processed).at(-1)).toBe(ActionType.ScoreGame)
        expect(table.state.machineState).toBe(MachineState.EndOfGame)
        expect(table.hydrated().startingPlayerId).toBe(first)
        expect(table.seat(first).pouch).toBe('saltpeter')
        expect(table.seat(first).played).not.toEqual([])
    })
})

describe('R-6.3 the end of the game', () => {
    it('R-6.3 EndOfGame is terminal: nobody is asked, nothing is offered or accepted', () => {
        const { table, order } = playToDawn(5)

        expect(table.state.activePlayerIds).toEqual([])
        for (const playerId of order) {
            expect(table.offered(playerId)).toEqual([])
        }
        expect(() => table.send(order[0], { type: ActionType.ForfeitCard, kind: 'move' })).toThrow(
            'A Game State with a result accepts no further Actions'
        )
    })

    it('R-6.3 the terminal handler offers nothing, and refuses to run without a result', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
        const context = new MachineContext({
            gameConfig: table.game.config,
            gameState: table.hydrated()
        })

        const handler = FeudumRuntime.stateHandlers[MachineState.EndOfGame]
        expect(() => handler.enter(context)).toThrow('R-6.3')
        expect(handler.validActionsForPlayer(table.order[0], context)).toEqual([])
    })

    it('R-6.3 the recorded result is one the platform accepts', () => {
        const { table } = playToDawn(5)

        expect(() => validateGameResult(table.state)).not.toThrow()
        expect([GameResult.Win, GameResult.Draw]).toContain(table.state.result)
    })

    it('R-6.1 a game not yet at V can not be scored', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
        table.moveTo(() => MachineState.EndOfRound)

        expect(() => table.sendSystem({ type: ActionType.ScoreGame, revealsInfo: true })).toThrow()
        expect(table.state.result).toBeUndefined()
    })

    it('R-2.2 before V the round end still leads to the next round', () => {
        const { table } = playToDawn(4)

        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.state.result).toBeUndefined()
    })
})

describe('R-4.4.3, R-6.2 a charter is sealed and named at ScoreGame alone', () => {
    const charterId: CharterId = 'writ.charter.monster-defeat'

    it('R-X.2 the reveal is the barrier and no earlier Action names the charter', () => {
        const { processed, order } = playToDawn(5, (state, [holder]) => {
            holdWrit(state, holder, charterId)
            giveSeal(state, holder)
            meetCharter(state, holder, charterId)
        })

        const reveal = processed.at(-1)
        expect(reveal?.type).toBe(ActionType.ScoreGame)
        expect(reveal?.revealsInfo).toBe(true)
        expect(rowOf(scoredIn(processed), order[0]).charters.map((row) => row.writId)).toEqual([
            charterId
        ])
        for (const action of processed.slice(0, -1)) {
            expect(recordedText(action)).not.toContain(charterId)
        }
    })
})
