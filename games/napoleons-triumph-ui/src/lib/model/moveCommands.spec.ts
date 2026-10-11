import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { ActionType, CommandKind, Side, commanderDefinition } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import {
    moveCommandOptions,
    moveOrder,
    reinforcementsOf,
    rideOnOrder,
    type CommandedGroup
} from './moveCommands.js'

function alliedTurn() {
    const game = new TestGame()
    game.deployBoth()
    const state = game.hydrated
    const corps: CommandedGroup = {
        commander: state.commander('langeron'),
        units: state.corpsUnits('langeron')
    }
    return { game, state, playerId: game.playerOf(Side.Allied), corps }
}

function idsOf(group: CommandedGroup): string[] {
    return group.units.map((unit) => unit.id)
}

describe('the commands a picked-up group may be given', () => {
    it('is the Corps Move alone for a whole corps', () => {
        const { state, playerId, corps } = alliedTurn()
        expect(moveCommandOptions(state, playerId, corps, idsOf(corps), true)).toEqual([
            CommandKind.Corps
        ])
    })

    it('leads with the Unit Move once one unit is chosen, the Corps Move still on offer', () => {
        const { state, playerId, corps } = alliedTurn()
        const [one] = idsOf(corps)
        expect(moveCommandOptions(state, playerId, corps, [one], false)).toEqual([
            CommandKind.Unit,
            CommandKind.Detach,
            CommandKind.Corps
        ])
    })

    it('has no Unit Move for several units', () => {
        const { state, playerId, corps } = alliedTurn()
        const some = idsOf(corps).slice(0, 2)
        expect(moveCommandOptions(state, playerId, corps, some, false)).toEqual([
            CommandKind.Detach,
            CommandKind.Corps
        ])
    })

    it('is the Unit Move alone for a detached unit, and nothing with no unit picked', () => {
        const { state, playerId, corps } = alliedTurn()
        const loose: CommandedGroup = { units: corps.units.slice(0, 1) }
        expect(moveCommandOptions(state, playerId, loose, idsOf(loose), false)).toEqual([
            CommandKind.Unit
        ])
        expect(moveCommandOptions(state, playerId, corps, [], true)).toEqual([])
    })

    it('leaves only the Unit Move once the commander has commanded', () => {
        const { game, playerId } = alliedTurn()
        game.arrange((arranged) => {
            arranged.commander('langeron').commandsThisTurn = 1
        })
        const state = game.hydrated
        const corps = {
            commander: state.commander('langeron'),
            units: state.corpsUnits('langeron')
        }
        const [one] = idsOf(corps)
        expect(moveCommandOptions(state, playerId, corps, idsOf(corps), true)).toEqual([])
        expect(moveCommandOptions(state, playerId, corps, [one], false)).toEqual([CommandKind.Unit])
    })
})

describe('the order a command gives', () => {
    it('names the commander for a Corps or Detach Move and only the unit for a Unit Move', () => {
        const { corps } = alliedTurn()
        const [one, two] = idsOf(corps)
        expect(moveOrder(CommandKind.Corps, corps, idsOf(corps))).toEqual({
            kind: CommandKind.Corps,
            commanderId: 'langeron',
            unitIds: idsOf(corps)
        })
        expect(moveOrder(CommandKind.Detach, corps, [one, two])).toEqual({
            kind: CommandKind.Detach,
            commanderId: 'langeron',
            unitIds: [one, two]
        })
        expect(moveOrder(CommandKind.Unit, corps, [one])).toEqual({
            kind: CommandKind.Unit,
            unitIds: [one]
        })
    })

    it('carries on a road march with the same command and units', () => {
        expect(rideOnOrder({ kind: CommandKind.Unit, unitIds: ['F-cav'] })).toEqual({
            kind: CommandKind.Unit,
            commanderId: undefined,
            unitIds: ['F-cav'],
            continues: true
        })
    })
})

describe('corps that can be brought on', () => {
    it('are the army’s own corps still off the map that may enter now', () => {
        const { game, state } = alliedTurn()
        expect(reinforcementsOf(state, Side.Allied)).toEqual([])
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        const french = game.playerOf(Side.French)
        const offMap = reinforcementsOf(game.hydrated, Side.French)
        expect(offMap.length).toBeGreaterThan(0)
        for (const reinforcement of offMap) {
            const { commander } = reinforcement
            assertExists(commander, 'Expected a corps')
            expect(reinforcement.playerId).toBe(french)
            expect(commander.position).toBeUndefined()
            expect(reinforcement.name).toBe(commanderDefinition(commander.id).name)
            expect(reinforcement.units).toEqual(game.hydrated.corpsUnits(commander.id))
        }
        expect(new Set(offMap.map((reinforcement) => reinforcement.key)).size).toBe(offMap.length)
    })

    it('are joined by the units a corps left off the map when it came on, which follow one at a time', () => {
        const { game } = alliedTurn()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        const french = game.playerOf(Side.French)
        const entry = game.hydrated.map.entries(Side.French).find((candidate) => candidate.main)
        assertExists(entry, 'Expected a main-road entry for the French')
        const [leader, ...rest] = game.hydrated.corpsUnits('bernadotte').map((unit) => unit.id)
        game.act(ActionType.Move, french, {
            order: {
                kind: CommandKind.Corps,
                commanderId: 'bernadotte',
                unitIds: [leader],
                entryId: entry.id,
                road: [entry.locale]
            },
            to: { locale: entry.locale }
        })
        const state = game.hydrated
        const leftBehind = reinforcementsOf(state, Side.French).find(
            (reinforcement) => reinforcement.commander === undefined
        )
        assertExists(leftBehind, 'Expected the units left behind to be offered')
        expect(leftBehind.units.map((unit) => unit.id).toSorted()).toEqual(rest.toSorted())
        expect(moveCommandOptions(state, french, leftBehind, [rest[0]], false)).toEqual([
            CommandKind.Unit
        ])
        expect(moveCommandOptions(state, french, leftBehind, rest, true)).toEqual([])
    })
})
