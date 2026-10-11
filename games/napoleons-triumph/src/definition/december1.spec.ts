import { assertExists } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Side, commandersOf } from '../components/pieces.js'
import { Scenario, roundLabel } from '../components/timeTrack.js'
import { CommandKind } from '../model/attack.js'
import { VictoryKind } from '../model/gameState.js'
import type { Deployment } from '../model/setup.js'
import { TestGame, cavalry, passTurns } from '../testing/harness.js'
import { ActionType } from './actions.js'
import { MachineState } from './states.js'

const HOURS = [
    '7:00AM',
    '8:00AM',
    '9:00AM',
    '10:00AM',
    '11:00AM',
    '12:00PM',
    '1:00PM',
    '2:00PM',
    '3:00PM',
    '4:00PM'
]
const TIME_TRACK = [
    ...HOURS.map((hour) => `1 December · ${hour}`),
    '1 December · Night',
    ...HOURS.map((hour) => `2 December · ${hour}`)
]

const ALLIED_ENTRY_LOCALE = 59
const BEYOND_THE_ALLIED_ENTRY = 58
const FRENCH_ENTRY_LOCALE = 51
const BEYOND_THE_FRENCH_ENTRY = 38

function twoDayGame(): TestGame {
    return new TestGame({ scenario: Scenario.December1 })
}

function label(game: TestGame): string {
    return roundLabel(game.hydrated.currentRound, true)
}

function mainRoadEntry(side: Side, locale: number): string {
    const entry = AUSTERLITZ.entries(side).find(
        (candidate) => candidate.main && candidate.locale === locale
    )
    assertExists(entry, `No main road enters the map at locale ${locale}`)
    return entry.id
}

function corpsMove(game: TestGame, commanderId: string) {
    return {
        kind: CommandKind.Corps,
        commanderId,
        unitIds: game.hydrated.corpsUnits(commanderId).map((unit) => unit.id)
    }
}

function comeOn(game: TestGame, side: Side, commanderId: string) {
    const locale = side === Side.French ? FRENCH_ENTRY_LOCALE : ALLIED_ENTRY_LOCALE
    return game.act(ActionType.Move, game.playerOf(side), {
        order: {
            ...corpsMove(game, commanderId),
            entryId: mainRoadEntry(side, locale),
            road: [locale]
        },
        to: { locale }
    })
}

function startOnMap(commanderIds: readonly string[]) {
    return (deployment: Deployment) => {
        deployment.corps = deployment.corps.map(({ commanderId, unitIds }) =>
            commanderIds.includes(commanderId)
                ? { commanderId, unitIds }
                : { commanderId, unitIds, offMap: true }
        )
    }
}

describe('the 1 December scenario (rules 5 and 7)', () => {
    it('runs from 7:00AM on 1 December through the night to 4:00PM on 2 December, the Allies moving first in every round', () => {
        const game = twoDayGame()
        game.deployBoth()
        const turns: [string, Side][] = []
        while (game.state.machineState !== MachineState.EndOfGame) {
            turns.push([label(game), game.hydrated.sideOf(game.activePlayerId)])
            passTurns(game, 1)
        }
        expect(turns).toEqual(
            TIME_TRACK.flatMap((round) => [
                [round, Side.Allied],
                [round, Side.French]
            ])
        )
        expect(game.hydrated.victory).toBe(VictoryKind.Marginal)
        expect(game.hydrated.winningPlayerIds).toEqual([game.playerOf(Side.French)])
    })
})

describe('setting up for 1 December (rule 6)', () => {
    const alliedCommanders = commandersOf(Side.Allied).map((commander) => commander.id)

    it('puts two Allied corps of the Allied player’s choice on the map and keeps the rest off it', () => {
        const chosen = ['langeron', 'miloradovich']
        const game = twoDayGame()
        game.deploy(Side.Allied, startOnMap(chosen))
        const state = game.hydrated
        expect(state.machineState).toBe(MachineState.FrenchSetup)
        expect(state.commander('langeron').position).toEqual({ locale: 106 })
        expect(state.commander('miloradovich').position).toEqual({ locale: 96 })
        for (const commanderId of alliedCommanders) {
            const corps = state.corpsUnits(commanderId)
            expect(corps.length).toBeGreaterThanOrEqual(3)
            for (const unit of corps) {
                expect(unit.position).toEqual(state.commander(commanderId).position)
            }
            if (!chosen.includes(commanderId)) {
                expect(state.commander(commanderId).position).toBeUndefined()
            }
        }
    })

    it.each([1, 3, 9])('does not let %i Allied corps start on the map', (count) => {
        const game = twoDayGame()
        expect(() =>
            game.deploy(Side.Allied, startOnMap(alliedCommanders.slice(0, count)))
        ).toThrow(/Two Allied corps/)
    })

    it('is not open to the Allies on 2 December, when their whole army starts on the map', () => {
        const game = new TestGame()
        expect(() => game.deploy(Side.Allied, startOnMap(alliedCommanders.slice(0, 2)))).toThrow(
            /on the map/
        )
    })

    it('sets the French up as on 2 December, Bernadotte and Davout off the map', () => {
        const frenchSetUp = (game: TestGame) => {
            game.deployBoth()
            const state = game.hydrated
            return state.commandersOf(game.playerOf(Side.French)).map((commander) => ({
                id: commander.id,
                position: commander.position,
                units: state.corpsUnits(commander.id).length
            }))
        }
        const dayBefore = frenchSetUp(twoDayGame())
        expect(dayBefore).toEqual(frenchSetUp(new TestGame()))
        expect(
            dayBefore.filter((corps) => corps.position === undefined).map((corps) => corps.id)
        ).toEqual(['bernadotte', 'davout'])
    })
})

describe('Allied reinforcements on 1 December (rule 10)', () => {
    function waiting(): { game: TestGame; allied: string; offMap: string[] } {
        const game = twoDayGame()
        game.deployBoth()
        const state = game.hydrated
        const allied = game.playerOf(Side.Allied)
        const offMap = state
            .commandersOf(allied)
            .filter((commander) => commander.position === undefined)
            .map((commander) => commander.id)
        return { game, allied, offMap }
    }

    it('may march on from the first round, as a corps by road at an Allied entry', () => {
        const { game, offMap } = waiting()
        expect(offMap).toHaveLength(7)
        expect(label(game)).toBe('1 December · 7:00AM')
        comeOn(game, Side.Allied, offMap[0])
        const state = game.hydrated
        expect(state.commander(offMap[0]).position).toEqual({ locale: ALLIED_ENTRY_LOCALE })
        for (const unit of state.corpsUnits(offMap[0])) {
            expect(unit.position).toEqual({ locale: ALLIED_ENTRY_LOCALE })
        }
        expect(state.playerOf(Side.Allied).corpsCommandsUsed).toBe(1)
        expect(state.playerOf(Side.Allied).morale).toBe(27)
        expect(state.playerOf(Side.French).morale).toBe(23)
        expect(state.frenchReinforcementsEntered).toBe(false)
    })

    it('must use road movement, an entry of their own army and a command that can go by road', () => {
        const { game, allied, offMap } = waiting()
        const corps = corpsMove(game, offMap[0])
        const road = {
            entryId: mainRoadEntry(Side.Allied, ALLIED_ENTRY_LOCALE),
            road: [ALLIED_ENTRY_LOCALE]
        }
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: corps,
                to: { locale: ALLIED_ENTRY_LOCALE }
            })
        ).toThrow(/by road/)
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: {
                    ...corps,
                    entryId: mainRoadEntry(Side.French, FRENCH_ENTRY_LOCALE),
                    road: [FRENCH_ENTRY_LOCALE]
                },
                to: { locale: FRENCH_ENTRY_LOCALE }
            })
        ).toThrow(/not an entry for this army/)
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: {
                    ...corps,
                    ...road,
                    kind: CommandKind.Detach,
                    unitIds: corps.unitIds.slice(1)
                },
                to: { locale: ALLIED_ENTRY_LOCALE }
            })
        ).toThrow(/by road/)
    })

    it('may come on one unit at a time by Unit Moves, leaving their corps off the map', () => {
        const { game, allied, offMap } = waiting()
        const [unitId, ...others] = corpsMove(game, offMap[0]).unitIds
        game.act(ActionType.Move, allied, {
            order: {
                kind: CommandKind.Unit,
                unitIds: [unitId],
                entryId: mainRoadEntry(Side.Allied, ALLIED_ENTRY_LOCALE),
                road: [ALLIED_ENTRY_LOCALE]
            },
            to: { locale: ALLIED_ENTRY_LOCALE }
        })
        const state = game.hydrated
        expect(state.unit(unitId).position).toEqual({ locale: ALLIED_ENTRY_LOCALE })
        expect(state.unit(unitId).commanderId).toBeUndefined()
        expect(state.commander(offMap[0]).position).toBeUndefined()
        expect(state.corpsUnits(offMap[0]).map((unit) => unit.id)).toEqual(others)
        expect(state.playerOf(Side.Allied).independentCommandsUsed).toBe(1)
    })

    it('get one command in the turn they come on, not the two the French get', () => {
        const { game, allied, offMap } = waiting()
        comeOn(game, Side.Allied, offMap[0])
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: corpsMove(game, offMap[0]),
                to: { locale: BEYOND_THE_ALLIED_ENTRY }
            })
        ).toThrow()
        const [unitId] = corpsMove(game, offMap[0]).unitIds
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: { kind: CommandKind.Unit, unitIds: [unitId] },
                to: { locale: BEYOND_THE_ALLIED_ENTRY }
            })
        ).toThrow()
    })

    it('cannot use an entry locale the enemy occupies', () => {
        const { game, offMap } = waiting()
        game.arrange((state) => {
            state.units.push({
                id: 'F-picket',
                playerId: state.playerOf(Side.French).playerId,
                face: cavalry(2),
                position: { locale: ALLIED_ENTRY_LOCALE }
            })
        })
        expect(() => comeOn(game, Side.Allied, offMap[0])).toThrow(/cannot be entered/)
    })
})

describe('French reinforcements on 1 December (rule 10)', () => {
    function frenchTurnAt(game: TestGame, round: string) {
        const french = game.playerOf(Side.French)
        while (label(game) !== round || game.activePlayerId !== french) {
            passTurns(game, 1)
        }
    }

    it('wait for the hour the Time Track gives them: Bernadotte 11:00AM on the 1st, Davout 8:00AM on the 2nd', () => {
        const game = twoDayGame()
        game.deployBoth()
        for (const tooEarly of ['1 December · 7:00AM', '1 December · 10:00AM']) {
            frenchTurnAt(game, tooEarly)
            expect(() => comeOn(game, Side.French, 'bernadotte')).toThrow(/not arrived/)
        }
        frenchTurnAt(game, '1 December · 11:00AM')
        comeOn(game, Side.French, 'bernadotte')
        expect(game.hydrated.commander('bernadotte').position).toEqual({
            locale: FRENCH_ENTRY_LOCALE
        })
        expect(game.hydrated.playerOf(Side.French).morale).toBe(27)

        game.act(ActionType.Move, game.playerOf(Side.French), {
            order: corpsMove(game, 'bernadotte'),
            to: { locale: BEYOND_THE_FRENCH_ENTRY }
        })
        expect(game.hydrated.commander('bernadotte').position).toEqual({
            locale: BEYOND_THE_FRENCH_ENTRY
        })

        for (const tooEarly of [
            '1 December · 11:00AM',
            '1 December · 4:00PM',
            '1 December · Night',
            '2 December · 7:00AM'
        ]) {
            frenchTurnAt(game, tooEarly)
            expect(() => comeOn(game, Side.French, 'davout')).toThrow(/not arrived/)
        }
        frenchTurnAt(game, '2 December · 8:00AM')
        comeOn(game, Side.French, 'davout')
        expect(game.hydrated.commander('davout').position).toEqual({ locale: FRENCH_ENTRY_LOCALE })
        expect(game.hydrated.playerOf(Side.French).morale).toBe(27)
    })
})
