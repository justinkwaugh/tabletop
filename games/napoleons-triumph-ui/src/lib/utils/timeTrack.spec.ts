import { describe, expect, it } from 'vitest'
import { Scenario, roundLabel } from '@tabletop/napoleons-triumph'
import { TestGame, passTurns, playOut } from '@tabletop/napoleons-triumph/testing'
import { onBattlefield } from '$lib/map/battlefield.js'
import { timeMarker } from './timeTrack.js'

function underway(scenario: Scenario): TestGame {
    const game = new TestGame({ scenario })
    game.deployBoth()
    return game
}

function at(game: TestGame, round: string) {
    while (roundLabel(game.hydrated.currentRound, true) !== round) {
        passTurns(game, 1)
    }
    return timeMarker(game.hydrated)
}

describe('the marker on the time track', () => {
    it("stands on the scenario's start box while the armies set up", () => {
        for (const scenario of [Scenario.December2, Scenario.December1]) {
            const settingUp = timeMarker(new TestGame({ scenario }).hydrated)
            expect(settingUp).toEqual(timeMarker(underway(scenario).hydrated))
        }
    })

    it('moves one box along its row when both armies have had their turn', () => {
        const game = underway(Scenario.December2)
        const seven = timeMarker(game.hydrated)
        passTurns(game, 1)
        expect(timeMarker(game.hydrated)).toEqual(seven)
        passTurns(game, 1)
        const eight = timeMarker(game.hydrated)
        passTurns(game, 2)
        const nine = timeMarker(game.hydrated)
        expect(eight.y).toBe(seven.y)
        expect(eight.x).toBeGreaterThan(seven.x)
        expect(nine.x - eight.x).toBeCloseTo(eight.x - seven.x)
    })

    it('keeps a row for each day', () => {
        const firstDay = timeMarker(underway(Scenario.December1).hydrated)
        const secondDay = timeMarker(underway(Scenario.December2).hydrated)
        expect(firstDay.y).toBeGreaterThan(secondDay.y)
    })

    it("spends the night at the head of the second day's row", () => {
        const game = underway(Scenario.December1)
        const night = at(game, '1 December · Night')
        const seven = at(game, '2 December · 7:00AM')
        const eight = at(game, '2 December · 8:00AM')
        expect(night.y).toBe(seven.y)
        expect(seven.x - night.x).toBeCloseTo(eight.x - seven.x)
        expect(seven).toEqual(timeMarker(underway(Scenario.December2).hydrated))
    })

    it('stays on the last box when the game is over, and never lies on the battlefield', () => {
        const game = underway(Scenario.December1)
        expect(onBattlefield(timeMarker(game.hydrated))).toBe(false)
        const four = at(game, '2 December · 4:00PM')
        expect(onBattlefield(four)).toBe(false)
        playOut(game)
        expect(timeMarker(game.hydrated)).toEqual(four)
    })
})
