import { describe, expect, it } from 'vitest'
import {
    MachineState,
    PhaseName,
    RAILROAD_IDS,
    RAILROAD_INTRODUCTIONS,
    RideTheRailsGameStateValidator,
    supplyOf
} from '@tabletop/ride-the-rails'
import {
    SEAT_NAMES,
    TABLE_FIXTURES,
    fixtureFile,
    fixturePosition,
    roundRecords,
    tableState
} from './tableFixtures.js'

// The harness lists every file in src/scenarios under Scenarios. Each file is this module's
// fixture, written by its file snapshot: run `vitest run -u tableFixtures` after changing one.
const SCENARIO_FILES = Object.keys(import.meta.glob('../../scenarios/*.json'))

const PHASE_STATES: Record<PhaseName, MachineState> = {
    [PhaseName.TakeShare]: MachineState.TakingShares,
    [PhaseName.Build]: MachineState.Building,
    [PhaseName.Ride]: MachineState.Riding
}

describe('the named table fixtures', () => {
    it.each(TABLE_FIXTURES)('$name is the file the harness offers', async (fixture) => {
        const file = fixtureFile(fixture)
        expect(file.fileName).toBe(`${fixture.slug}.json`)
        // The harness's menu names a file by its slug, first letter capitalised.
        const spaced = fixture.slug.replaceAll('-', ' ')
        expect(fixture.name).toBe(spaced.charAt(0).toUpperCase() + spaced.slice(1))
        await expect(file.contents).toMatchFileSnapshot(`../../scenarios/${file.fileName}`)
    })

    it('are the only scenario files', () => {
        const files = SCENARIO_FILES.map((path) => path.split('/').at(-1))
        expect(files.toSorted()).toEqual(
            TABLE_FIXTURES.map((fixture) => `${fixture.slug}.json`).toSorted()
        )
    })

    it.each(TABLE_FIXTURES)('$name is a legal position', (fixture) => {
        const { recipe } = fixture
        const { game, state } = fixturePosition(fixture)
        expect(RideTheRailsGameStateValidator.Check(state)).toBe(true)
        expect(game.id).toBe(`scenario-${fixture.slug}`)
        expect(state.machineState).toBe(PHASE_STATES[recipe.phase])
        expect(state.activePlayerIds).toHaveLength(1)
        expect(game.players.map((player) => player.name)).toEqual(
            SEAT_NAMES.slice(0, recipe.playerCount)
        )

        const hydrated = tableState(recipe)
        const round = recipe.rounds.length
        // R-1.1: the shares and track of a railroad never exceed its 27 locomotives.
        for (const railroadId of RAILROAD_IDS) {
            expect(supplyOf(hydrated, railroadId)).toBeGreaterThanOrEqual(0)
        }
        // R-3.1, R-1.4: one share a round per seat, of a railroad available that round.
        for (const [index, played] of recipe.rounds.entries()) {
            for (const railroadId of Object.values(played.shares)) {
                const introduction = RAILROAD_INTRODUCTIONS[hydrated.mapId].find(
                    (candidate) => candidate.railroadId === railroadId
                )
                expect(introduction?.availableFromRound).toBeLessThanOrEqual(index + 1)
            }
            const complete = index + 1 < round || recipe.phase !== PhaseName.TakeShare
            if (complete) {
                expect(Object.keys(played.shares)).toHaveLength(recipe.playerCount)
            }
        }
        // R-3.3.6: a passenger leaves only with a journey, at most one a seat in each round ridden,
        // and in this round's Ride phase one for each seat before the deciding one (R-2.2).
        const riddenRounds = round - 1
        const riddenThisRound =
            recipe.phase === PhaseName.Ride
                ? hydrated.turnManager.turnOrder.indexOf(state.activePlayerIds[0] ?? '')
                : 0
        expect(riddenThisRound).toBeGreaterThanOrEqual(0)
        expect(recipe.carried?.length ?? 0).toBeLessThanOrEqual(
            riddenRounds * recipe.playerCount + riddenThisRound
        )
        for (const cityId of recipe.carried ?? []) {
            expect(hydrated.passengers).not.toContain(cityId)
        }
    })

    it.each(TABLE_FIXTURES)("$name's turn order is the one its rounds' money sets", (fixture) => {
        const { recipe } = fixture
        const records = roundRecords(recipe)
        expect(records).toHaveLength(recipe.rounds.length)
        // R-1.3.7: the first round keeps the assigned starting order.
        expect(records[0]?.turnOrder).toEqual(
            fixturePosition(fixture).game.players.map((p) => p.id)
        )
        for (const [index, record] of records.entries()) {
            const played = recipe.rounds[index]
            // R-2.2: building turns run in turn order; a part-taken Take a Share, in reverse.
            const builders = played?.builds.map((turn) => turn.playerId) ?? []
            expect(builders).toEqual(
                record.turnOrder.filter((playerId) => builders.includes(playerId))
            )
            const sharers = Object.keys(played?.shares ?? {})
            if (sharers.length < recipe.playerCount) {
                expect(sharers).toEqual(record.turnOrder.toReversed().slice(0, sharers.length))
            }
            const previous = records[index - 1]
            if (!previous) continue
            // R-2.5.1: lowest money first at the round's end; tied seats swap.
            const money = (playerId: string) => previous.money[playerId] ?? 0
            for (const [position, playerId] of record.turnOrder.entries()) {
                const next = record.turnOrder[position + 1]
                if (next === undefined) continue
                expect(money(playerId)).toBeLessThanOrEqual(money(next))
                if (money(playerId) === money(next)) {
                    expect(previous.turnOrder.indexOf(playerId)).toBeGreaterThan(
                        previous.turnOrder.indexOf(next)
                    )
                }
            }
        }
        const state = tableState(recipe)
        expect(state.turnManager.turnOrder).toEqual(records.at(-1)?.turnOrder)
        if (recipe.phase === PhaseName.TakeShare) {
            // R-2.2: the deciding seat is the next in reverse turn order.
            const taken = Object.keys(recipe.rounds.at(-1)?.shares ?? {}).length
            expect(state.activePlayerIds).toEqual([state.turnManager.turnOrder.toReversed()[taken]])
        }
    })
})
