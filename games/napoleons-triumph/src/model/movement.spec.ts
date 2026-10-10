import { describe, expect, it } from 'vitest'
import { Side, UnitType } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { TestGame, arrangeBattlefield, infantry, type PiecePlacement } from '../testing/harness.js'
import { CommandKind } from './attack.js'
import { faceOf } from './pieces.js'

function corpsOrder(game: TestGame, commanderId: string, unitIds?: string[]) {
    return {
        kind: CommandKind.Corps,
        commanderId,
        unitIds: unitIds ?? game.hydrated.corpsUnits(commanderId).map((unit) => unit.id)
    }
}

describe('ordinary movement', () => {
    it('moves a corps from reserve to block an approach of its locale', () => {
        const game = new TestGame()
        game.deployBoth()
        const allied = game.playerOf(Side.Allied)
        const approach = game.hydrated.map.approachBetween(106, 94).id
        game.act(ActionType.Move, allied, {
            order: corpsOrder(game, 'langeron'),
            to: { locale: 106, approach }
        })
        const state = game.hydrated
        expect(state.commander('langeron').position).toEqual({ locale: 106, approach })
        expect(state.corpsUnits('langeron').every((unit) => unit.position?.approach === approach)).toBe(true)
        expect(state.getPlayerState(allied).corpsCommandsUsed).toBe(1)
    })

    it('moves a corps into the reserve of an adjacent empty locale and leaves detachments behind', () => {
        const game = new TestGame()
        game.deployBoth()
        const allied = game.playerOf(Side.Allied)
        const corps = game.hydrated.corpsUnits('langeron').map((unit) => unit.id)
        const [stays, ...moving] = corps
        game.act(ActionType.Move, allied, {
            order: corpsOrder(game, 'langeron', moving),
            to: { locale: 94 }
        })
        const state = game.hydrated
        expect(state.commander('langeron').position).toEqual({ locale: 94 })
        expect(state.unit(stays).position).toEqual({ locale: 106 })
        expect(state.unit(stays).commanderId).toBeUndefined()
        expect(state.corpsUnits('langeron').map((unit) => unit.id)).toEqual(moving)
    })

    it('refuses a second command from the same commander and a second move of the same unit', () => {
        const game = new TestGame()
        game.deployBoth()
        const allied = game.playerOf(Side.Allied)
        game.act(ActionType.Move, allied, { order: corpsOrder(game, 'langeron'), to: { locale: 94 } })
        expect(() =>
            game.act(ActionType.Move, allied, { order: corpsOrder(game, 'langeron'), to: { locale: 106 } })
        ).toThrow()
        const [unitId] = game.hydrated.corpsUnits('langeron').map((unit) => unit.id)
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: { kind: CommandKind.Unit, unitIds: [unitId] },
                to: { locale: 106 }
            })
        ).toThrow()
    })

    it('limits the Allies to three independent commands', () => {
        const game = new TestGame()
        game.deployBoth()
        const allied = game.playerOf(Side.Allied)
        const units = game.hydrated.corpsUnits('bagration').map((unit) => unit.id)
        const approach = game.hydrated.map.passableApproachesOf(67)[0].id
        for (const unitId of units.slice(0, 3)) {
            game.act(ActionType.Move, allied, {
                order: { kind: CommandKind.Unit, unitIds: [unitId] },
                to: { locale: 67, approach }
            })
        }
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: { kind: CommandKind.Unit, unitIds: [units[3]] },
                to: { locale: 67, approach }
            })
        ).toThrow()
    })

    it('does not let a piece cross from one approach straight to another', () => {
        const game = new TestGame()
        game.deployBoth()
        const allied = game.playerOf(Side.Allied)
        const [first, second] = game.hydrated.map.passableApproachesOf(106)
        game.act(ActionType.Move, allied, {
            order: corpsOrder(game, 'langeron'),
            to: { locale: 106, approach: first.id }
        })
        game.act(ActionType.EndTurn, allied)
        game.act(ActionType.EndTurn, game.playerOf(Side.French))
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: corpsOrder(game, 'langeron'),
                to: { locale: 106, approach: second.id }
            })
        ).toThrow()
    })
})

describe('road movement', () => {
    it('lets a corps march two locales along a local road and closes the reserves it passed', () => {
        const game = new TestGame()
        game.deployBoth()
        const allied = game.playerOf(Side.Allied)
        const state = game.hydrated
        const first = state.map.roadLinksFrom(96)[0]
        const second = state.map
            .roadLinksFrom(first.to)
            .find((link) => link.fromGroup === first.toGroup && link.to !== 96 && !state.occupantOf(link.to))
        expect(second).toBeDefined()
        if (!second) return
        game.act(ActionType.Move, allied, {
            order: { ...corpsOrder(game, 'miloradovich'), road: [first.to, second.to] },
            to: { locale: second.to }
        })
        const after = game.hydrated
        expect(after.commander('miloradovich').position).toEqual({ locale: second.to })
        expect(after.limits.marchedLocales).toEqual([first.to, second.to])
    })

    it('brings Davout on by road at 8:00AM, not before, and raises French morale', () => {
        const game = new TestGame()
        game.deployBoth()
        const french = game.playerOf(Side.French)
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        const entry = game.hydrated.map.entries(Side.French).find((candidate) => candidate.main)
        expect(entry).toBeDefined()
        if (!entry) return
        const davout = corpsOrder(game, 'davout')
        expect(() =>
            game.act(ActionType.Move, french, {
                order: { ...davout, entryId: entry.id, road: [entry.locale] },
                to: { locale: entry.locale }
            })
        ).toThrow()
        const bernadotte = corpsOrder(game, 'bernadotte')
        game.act(ActionType.Move, french, {
            order: { ...bernadotte, entryId: entry.id, road: [entry.locale] },
            to: { locale: entry.locale }
        })
        const state = game.hydrated
        expect(state.commander('bernadotte').position).toEqual({ locale: entry.locale })
        expect(state.frenchReinforcementsEntered).toBe(true)
        expect(state.playerOf(Side.French).morale).toBe(27)
    })

    it('only lets cavalry end a road move on an approach, and shows it', () => {
        const game = new TestGame()
        game.deployBoth()
        const allied = game.playerOf(Side.Allied)
        const state = game.hydrated
        const corps = state.corpsUnits('miloradovich')
        const cavalry = corps.find((unit) => faceOf(unit).type === UnitType.Cavalry)
        const infantry = corps.find((unit) => faceOf(unit).type === UnitType.Infantry)
        const link = state.map.roadLinksFrom(96).find((candidate) => !state.occupantOf(candidate.to))
        expect(link && infantry).toBeTruthy()
        if (!link || !infantry) return
        const approach = state.map.approach(link.exit).opposite
        expect(() =>
            game.act(ActionType.Move, allied, {
                order: { kind: CommandKind.Unit, unitIds: [infantry.id], road: [link.to] },
                to: { locale: link.to, approach }
            })
        ).toThrow()
        if (!cavalry) return
        game.act(ActionType.Move, allied, {
            order: { kind: CommandKind.Unit, unitIds: [cavalry.id], road: [link.to] },
            to: { locale: link.to, approach }
        })
        expect(game.hydrated.unit(cavalry.id).shown).toEqual(faceOf(cavalry))
    })
})

describe('erratum to rule 8: road movement and capacity', () => {
    const START = 38
    const THROUGH = 52
    const END = 53

    function frenchRoadMove(fillers: number) {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        const garrison: PiecePlacement[] = Array.from({ length: fillers }, (_, index) => ({
            id: `F-fill-${index}`,
            side: Side.French,
            face: infantry(2),
            locale: THROUGH
        }))
        arrangeBattlefield(game, [
            { id: 'F-mover', side: Side.French, face: infantry(2), locale: START },
            ...garrison
        ])
        return () =>
            game.act(ActionType.Move, game.playerOf(Side.French), {
                order: { kind: CommandKind.Unit, unitIds: ['F-mover'], road: [THROUGH, END] },
                to: { locale: END }
            })
    }

    it('passes through a locale with room to spare', () => {
        const capacity = new TestGame().hydrated.map.locale(THROUGH).capacity
        expect(frenchRoadMove(capacity - 1)).not.toThrow()
    })

    it('cannot pass through a locale that is full', () => {
        const capacity = new TestGame().hydrated.map.locale(THROUGH).capacity
        expect(frenchRoadMove(capacity)).toThrow(/full/)
    })
})
