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
        // R-1.1-H1: the shares and track of a railroad never exceed its 27 locomotives.
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
        // R-3.3.6: a passenger leaves only with a journey, at most one a seat in each round ridden.
        const ridden = round - 1
        expect(recipe.carried?.length ?? 0).toBeLessThanOrEqual(ridden * recipe.playerCount)
        for (const cityId of recipe.carried ?? []) {
            expect(hydrated.passengers).not.toContain(cityId)
        }
    })
})
