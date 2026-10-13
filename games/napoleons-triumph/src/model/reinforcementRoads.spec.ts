import { describe, expect, it } from 'vitest'
import { assertExists } from '@tabletop/common'
import { Side, type Face } from '../components/pieces.js'
import { ActionType } from '../definition/actions.js'
import { TestGame, cavalry, frenchTurn, infantry, type PiecePlacement } from '../testing/harness.js'
import { waitOffMap } from '../testing/reinforcements.js'
import { CommandKind } from './attack.js'

const COMMANDER = 'bernadotte'
const ENTRY_LOCALE = 89
const ON_THE_ENTRY_ROAD = 79
const ON_ANOTHER_ROAD = 90

function waiting(faces: readonly Face[], onMap: readonly PiecePlacement[] = []): TestGame {
    const game = frenchTurn([
        { id: 'A-far', side: Side.Allied, face: infantry(1), locale: 20 },
        ...onMap
    ])
    waitOffMap(
        game,
        COMMANDER,
        faces.map((face, index) => ({ id: `F-${index + 1}`, face }))
    )
    return game
}

function corps(game: TestGame) {
    return {
        kind: CommandKind.Corps,
        commanderId: COMMANDER,
        unitIds: game.hydrated.corpsUnits(COMMANDER).map((unit) => unit.id)
    }
}

function comeOn(game: TestGame, road: number[]) {
    const entry = game.hydrated.map
        .entries(Side.French)
        .find(
            (candidate) =>
                candidate.locale === ENTRY_LOCALE &&
                game.hydrated.map.traceRoad({ entryId: candidate.id }, road).length > 0
        )
    assertExists(entry, 'Expected an entry road that leads that way')
    game.act(ActionType.Move, game.playerOf(Side.French), {
        order: { ...corps(game), entryId: entry.id, road },
        to: { locale: road[road.length - 1] }
    })
}

describe('the roads of a reinforcement on its turn of entry (rule 10)', () => {
    it('are, for its second command, only those connected to the road it came on by', () => {
        const game = waiting([infantry(2)])
        const french = game.playerOf(Side.French)
        comeOn(game, [ENTRY_LOCALE])

        expect(game.hydrated.unit('F-1').arrivedByRoad?.locale).toBe(ENTRY_LOCALE)
        expect(() =>
            game.act(ActionType.Move, french, {
                order: { ...corps(game), road: [ON_ANOTHER_ROAD] },
                to: { locale: ON_ANOTHER_ROAD }
            })
        ).toThrow(/No connected road/)
        game.act(ActionType.Move, french, {
            order: { ...corps(game), road: [ON_THE_ENTRY_ROAD] },
            to: { locale: ON_THE_ENTRY_ROAD }
        })
        expect(game.hydrated.commander(COMMANDER).position).toEqual({ locale: ON_THE_ENTRY_ROAD })
    })

    it('are any road of its locale again on the next turn', () => {
        const game = waiting([infantry(2)])
        const french = game.playerOf(Side.French)
        comeOn(game, [ENTRY_LOCALE])
        game.act(ActionType.EndTurn, french)
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))

        expect(game.hydrated.unit('F-1').arrivedByRoad).toBeUndefined()
        game.act(ActionType.Move, french, {
            order: { ...corps(game), road: [ON_ANOTHER_ROAD] },
            to: { locale: ON_ANOTHER_ROAD }
        })
        expect(game.hydrated.commander(COMMANDER).position).toEqual({ locale: ON_ANOTHER_ROAD })
    })

    it('leave a piece that began the turn in the same locale free to take any road', () => {
        const game = waiting(
            [infantry(2)],
            [{ id: 'F-here', side: Side.French, face: infantry(2), locale: ENTRY_LOCALE }]
        )
        comeOn(game, [ENTRY_LOCALE])
        game.act(ActionType.Move, game.playerOf(Side.French), {
            order: { kind: CommandKind.Unit, unitIds: ['F-here'], road: [ON_ANOTHER_ROAD] },
            to: { locale: ON_ANOTHER_ROAD }
        })
        expect(game.hydrated.unit('F-here').position).toEqual({ locale: ON_ANOTHER_ROAD })
    })

    it('bind cavalry that would attack by road with its second command', () => {
        const game = waiting(
            [cavalry(2)],
            [{ id: 'A-screen', side: Side.Allied, face: cavalry(1), locale: ON_ANOTHER_ROAD }]
        )
        const french = game.playerOf(Side.French)
        const map = game.hydrated.map
        const away = map
            .reachableNeighbours(ON_ANOTHER_ROAD)
            .find((locale) => locale !== ENTRY_LOCALE)
        comeOn(game, [ENTRY_LOCALE])
        game.act(ActionType.ThreatenAttack, french, {
            approach: map.approachBetween(ENTRY_LOCALE, ON_ANOTHER_ROAD).id
        })
        game.act(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: {},
            destinations: { 'A-screen': away },
            kept: {}
        })

        expect(() =>
            game.act(ActionType.Occupy, french, { orders: [{ ...corps(game), road: [] }] })
        ).toThrow(/does not carry the cavalry/)
        game.act(ActionType.Occupy, french, { orders: [corps(game)] })
        expect(game.hydrated.commander(COMMANDER).position).toEqual({ locale: ON_ANOTHER_ROAD })
    })
})

describe('a reserve closed by a corps marching in by road (rule 10)', () => {
    const marched = [ENTRY_LOCALE, ON_THE_ENTRY_ROAD]

    function marchedIn(onMap: readonly PiecePlacement[] = []): TestGame {
        const game = waiting([infantry(2), infantry(2)], onMap)
        comeOn(game, marched)
        return game
    }

    it('stays open to the corps that marched, on its second command', () => {
        const game = marchedIn()
        expect(game.hydrated.limits.marchedLocales).toEqual(marched)
        game.act(ActionType.Move, game.playerOf(Side.French), {
            order: corps(game),
            to: { locale: ENTRY_LOCALE }
        })
        expect(game.hydrated.commander(COMMANDER).position).toEqual({ locale: ENTRY_LOCALE })
    })

    it('stays open to one of its units sent back by a Unit Move', () => {
        const game = marchedIn()
        game.act(ActionType.Move, game.playerOf(Side.French), {
            order: { kind: CommandKind.Unit, unitIds: ['F-1'], road: [ENTRY_LOCALE] },
            to: { locale: ENTRY_LOCALE }
        })
        expect(game.hydrated.unit('F-1').position).toEqual({ locale: ENTRY_LOCALE })
    })

    it('is closed to every other unit', () => {
        const beside = new TestGame().hydrated.map
            .reachableNeighbours(ON_THE_ENTRY_ROAD)
            .find((locale) => !marched.includes(locale))
        assertExists(beside, 'Expected a locale beside the road')
        const game = marchedIn([
            { id: 'F-other', side: Side.French, face: infantry(2), locale: beside }
        ])
        expect(() =>
            game.act(ActionType.Move, game.playerOf(Side.French), {
                order: { kind: CommandKind.Unit, unitIds: ['F-other'] },
                to: { locale: ON_THE_ENTRY_ROAD }
            })
        ).toThrow(/cannot be entered/)
    })
})
