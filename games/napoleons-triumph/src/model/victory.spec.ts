import { GameResult, assertExists, validateGameResult } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { AUSTERLITZ } from '../components/austerlitz.js'
import { Star } from '../components/battleMap.js'
import { Side, opposingSide, type Face } from '../components/pieces.js'
import { roundLabel } from '../components/timeTrack.js'
import { ActionType } from '../definition/actions.js'
import { NapoleonsTriumphRuntime } from '../definition/runtime.js'
import { MachineState } from '../definition/states.js'
import {
    TestGame,
    artillery,
    assault,
    cavalry,
    frenchTurn,
    infantry,
    passTurns,
    playOut,
    type PiecePlacement
} from '../testing/harness.js'
import { CommandKind } from './attack.js'
import { VictoryKind } from './gameState.js'
import { Hold, objectiveHolds } from './victory.js'

const FROM = 95
const INTO = 108
const REFUGE = 96

const BLUE_STAR = 62
const RED_AND_BLACK_STARS = 126
const THREE_STARS = 128
const ONLY_ROAD_FROM_THREE_STARS = 127
const FRENCH_MAIN_ROAD_ENTRY = 51
const ALLIED_MAIN_ROAD_ENTRIES = [59, 87]
const FAR_NORTH_WEST = 1
const FAR_SOUTH_EAST = 170

function expectVictory(game: TestGame, side: Side, kind: VictoryKind) {
    const state = game.hydrated
    expect(state.machineState).toBe(MachineState.EndOfGame)
    expect(state.victory).toBe(kind)
    expect(state.result).toBe(GameResult.Win)
    expect(state.winningPlayerIds).toEqual([game.playerOf(side)])
    expect(state.activePlayerIds).toEqual([])
    expect(() => validateGameResult(game.canonical)).not.toThrow()
    for (const playerId of [game.playerOf(side), game.playerOf(opposingSide(side))]) {
        expect(() => game.act(ActionType.EndTurn, playerId)).toThrow()
    }
}

function frenchMainRoadEntry() {
    const entry = AUSTERLITZ.entries(Side.French).find((candidate) => candidate.main)
    assertExists(entry, 'The French have a main-road entry')
    return entry
}

function marchOn(game: TestGame, commanderId: string, unitIds: string[]): unknown {
    const entry = frenchMainRoadEntry()
    return game.outcome(ActionType.Move, game.playerOf(Side.French), {
        order: {
            kind: CommandKind.Corps,
            commanderId,
            unitIds,
            entryId: entry.id,
            road: [entry.locale]
        },
        to: { locale: entry.locale }
    })
}

describe('the objectives on the map (rule 16)', () => {
    it('give the French one main-road entry and the Allies two', () => {
        const mainRoadEntries = (side: Side) =>
            AUSTERLITZ.entries(side)
                .filter((entry) => entry.main)
                .map((entry) => entry.locale)
        expect(mainRoadEntries(Side.French)).toEqual([FRENCH_MAIN_ROAD_ENTRY])
        expect(mainRoadEntries(Side.Allied)).toEqual(ALLIED_MAIN_ROAD_ENTRIES)
    })

    it('carry the stars these games are decided on', () => {
        expect(AUSTERLITZ.locale(BLUE_STAR).stars).toEqual([Star.Blue])
        expect(AUSTERLITZ.locale(RED_AND_BLACK_STARS).stars).toEqual([Star.Red, Star.Black])
        expect(AUSTERLITZ.locale(THREE_STARS).stars).toEqual([Star.Red, Star.Green, Star.Black])
        expect(AUSTERLITZ.roadLinksFrom(THREE_STARS).map((link) => link.to)).toEqual([
            ONLY_ROAD_FROM_THREE_STARS
        ])
    })
})

describe('a decisive victory (rules 13 and 16)', () => {
    const attacker = (face: Face, facing?: number): PiecePlacement => ({
        id: 'F-unit',
        side: Side.French,
        face,
        locale: FROM,
        facing
    })
    const defender = (face: Face, facing?: number): PiecePlacement => ({
        id: 'A-inf',
        side: Side.Allied,
        face,
        locale: INTO,
        facing
    })

    function attack(game: TestGame, defenseLeaders: string[]): unknown {
        return assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-inf'],
            defenseLeaders,
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-unit'] }],
            leaders: ['F-unit']
        })
    }

    it('goes to the attacker the moment the defending army is demoralized', () => {
        const game = frenchTurn([attacker(infantry(3)), defender(infantry(2))])
        game.arrange((state) => {
            state.playerOf(Side.Allied).morale = 2
        })
        expect(attack(game, ['A-inf'])).toMatchObject({
            attackerWon: true,
            moraleLost: 2,
            demoralizedId: game.playerOf(Side.Allied)
        })
        expectVictory(game, Side.French, VictoryKind.Decisive)
    })

    it('goes to the defender when an attack that is thrown back breaks the attacking army', () => {
        const game = frenchTurn([attacker(infantry(3)), defender(infantry(3), FROM)])
        game.arrange((state) => {
            state.playerOf(Side.French).morale = 2
        })
        expect(attack(game, ['A-inf'])).toMatchObject({
            attackerWon: false,
            moraleLost: 2,
            demoralizedId: game.playerOf(Side.French)
        })
        expectVictory(game, Side.Allied, VictoryKind.Decisive)
    })

    it('can be won by the strength an army loses in a retreat', () => {
        const game = frenchTurn([attacker(infantry(3)), defender(infantry(2))])
        game.arrange((state) => {
            state.playerOf(Side.Allied).morale = 1
        })
        game.act(ActionType.ThreatenAttack, game.playerOf(Side.French), {
            approach: AUSTERLITZ.approachBetween(FROM, INTO).id
        })
        const retreated = game.outcome(ActionType.Retreat, game.playerOf(Side.Allied), {
            losses: { 'A-inf': 1 },
            destinations: { 'A-inf': REFUGE },
            kept: {}
        })
        expect(retreated).toMatchObject({ beforeCombat: true, demoralized: true })
        expectVictory(game, Side.French, VictoryKind.Decisive)
    })

    it('cannot be won by artillery fire: the last point of morale survives it', () => {
        const game = frenchTurn([attacker(artillery(), INTO), defender(infantry(2))])
        game.arrange((state) => {
            state.playerOf(Side.Allied).morale = 1
        })
        expect(attack(game, [])).toMatchObject({ initialResult: 1, attackerWon: true })
        const state = game.hydrated
        expect(state.unit('A-inf').face).toEqual(infantry(1))
        expect(state.playerOf(Side.Allied).morale).toBe(1)
        expect(state.victory).toBeUndefined()
        expect(state.machineState).toBe(MachineState.Commanding)
    })
})

describe('French reinforcements (rules 13 and 16)', () => {
    function corps(game: TestGame, commanderId: string): string[] {
        return game.hydrated.corpsUnits(commanderId).map((unit) => unit.id)
    }

    it('add four to the morale the army then has, the first time one comes on and never again', () => {
        const game = new TestGame()
        game.deployBoth()
        game.arrange((state) => {
            state.playerOf(Side.French).morale = 10
        })
        passTurns(game, 1)
        expect(marchOn(game, 'bernadotte', corps(game, 'bernadotte'))).toMatchObject({
            frenchMoraleGain: 4
        })
        expect(game.hydrated.frenchReinforcementsEntered).toBe(true)
        expect(game.hydrated.playerOf(Side.French).morale).toBe(14)

        passTurns(game, 2)
        expect(roundLabel(game.hydrated.currentRound)).toBe('8:00AM')
        marchOn(game, 'davout', corps(game, 'davout'))
        expect(game.hydrated.commander('davout').position).toEqual({
            locale: FRENCH_MAIN_ROAD_ENTRY
        })
        expect(game.hydrated.playerOf(Side.French).morale).toBe(14)
        expect(game.hydrated.playerOf(Side.Allied).morale).toBe(27)
    })

    it('turn a French marginal victory with nothing held into an Allied one', () => {
        const unreinforced = new TestGame()
        unreinforced.deployBoth()
        playOut(unreinforced)
        expectVictory(unreinforced, Side.French, VictoryKind.Marginal)

        const reinforced = new TestGame()
        reinforced.deployBoth()
        passTurns(reinforced, 1)
        marchOn(reinforced, 'bernadotte', corps(reinforced, 'bernadotte'))
        playOut(reinforced)
        expectVictory(reinforced, Side.Allied, VictoryKind.Marginal)
    })
})

describe('the end of the game (rule 16)', () => {
    it('comes when both players have had their 4:00PM turn', () => {
        const game = new TestGame()
        game.deployBoth()
        passTurns(game, 18)
        expect(roundLabel(game.hydrated.currentRound)).toBe('4:00PM')
        expect(game.activePlayerId).toBe(game.playerOf(Side.Allied))
        passTurns(game, 1)
        expect(roundLabel(game.hydrated.currentRound)).toBe('4:00PM')
        expect(game.activePlayerId).toBe(game.playerOf(Side.French))
        expect(game.state.machineState).toBe(MachineState.Commanding)
        expect(game.hydrated.victory).toBeUndefined()
        passTurns(game, 1)
        expectVictory(game, Side.French, VictoryKind.Marginal)
    })
})

describe('the blocks once the game is over (rule 16)', () => {
    const enemyBlocksSeen = (game: TestGame, side: Side) => {
        const viewer = { kind: 'player' as const, playerId: game.playerOf(side) }
        const view = NapoleonsTriumphRuntime.visibility.state.project(game.canonical, viewer, {
            config: game.game.config
        })
        return view.units.filter((unit) => unit.playerId !== viewer.playerId)
    }

    it('are turned face-up for both players when the last turn has been played', () => {
        const game = new TestGame()
        game.deployBoth()
        passTurns(game, 19)
        expect(enemyBlocksSeen(game, Side.French).every((unit) => unit.shown === undefined)).toBe(
            true
        )
        const [lastTurn] = game.act(ActionType.EndTurn, game.playerOf(Side.French))
        expect(game.state.machineState).toBe(MachineState.EndOfGame)
        for (const side of [Side.French, Side.Allied]) {
            const enemy = enemyBlocksSeen(game, side)
            expect(enemy.length).toBeGreaterThan(0)
            expect(enemy.every((unit) => unit.shown !== undefined)).toBe(true)
        }
        expect(game.canonical.units.every((unit) => unit.shown?.type === unit.face.type)).toBe(true)
        expect(lastTurn.revealsInfo).toBe(true)
    })

    it('are turned face-up when an army breaks', () => {
        const game = frenchTurn([
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: FROM },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: INTO },
            { id: 'A-far', side: Side.Allied, face: cavalry(2), locale: REFUGE }
        ])
        game.arrange((state) => {
            state.playerOf(Side.Allied).morale = 2
        })
        assault(game, {
            attacker: Side.French,
            from: FROM,
            into: INTO,
            defenders: ['A-inf'],
            defenseLeaders: ['A-inf'],
            orders: [{ kind: CommandKind.Unit, unitIds: ['F-inf'] }],
            leaders: ['F-inf']
        })
        expect(game.state.machineState).toBe(MachineState.EndOfGame)
        expect(game.hydrated.unit('A-far').shown).toEqual(cavalry(2))
    })
})

describe('a marginal victory (rule 16)', () => {
    const alliedCorps = (locale: number, face: Face = infantry(2)): PiecePlacement => ({
        id: 'A-corps',
        side: Side.Allied,
        face,
        locale,
        commanderId: 'bagration'
    })
    const frenchCorps = (locale: number): PiecePlacement => ({
        id: 'F-corps',
        side: Side.French,
        face: infantry(2),
        locale,
        commanderId: 'lannes'
    })
    const picket = (side: Side, locale: number): PiecePlacement => ({
        id: `${side}-picket-${locale}`,
        side,
        face: cavalry(2),
        locale
    })
    const bystanders = [picket(Side.French, FAR_NORTH_WEST), picket(Side.Allied, FAR_SOUTH_EAST)]

    function winner(placements: readonly PiecePlacement[], reinforced = false): Side {
        const game = frenchTurn([...bystanders, ...placements])
        if (reinforced) {
            game.arrange((state) => {
                const bernadotte = state.commander('bernadotte')
                bernadotte.eliminated = undefined
                state.units.push({
                    id: 'F-late',
                    playerId: bernadotte.playerId,
                    face: infantry(2),
                    commanderId: bernadotte.id
                })
            })
            marchOn(game, 'bernadotte', ['F-late'])
        }
        playOut(game)
        const side = game.hydrated.sideOf(game.hydrated.winningPlayerIds[0])
        expectVictory(game, side, VictoryKind.Marginal)
        return side
    }

    describe('when no French reinforcement has come on', () => {
        it('is French when the Allies hold no blue star', () => {
            expect(winner([])).toBe(Side.French)
        })

        it('is Allied when they hold a blue star and the French no green, red or black one', () => {
            expect(winner([alliedCorps(BLUE_STAR)])).toBe(Side.Allied)
        })

        it('is French when they hold any of those, whatever the Allies hold', () => {
            expect(winner([alliedCorps(BLUE_STAR), frenchCorps(RED_AND_BLACK_STARS)])).toBe(
                Side.French
            )
        })
    })

    describe('once a French reinforcement has come on', () => {
        it('is Allied when nobody holds anything', () => {
            expect(winner([], true)).toBe(Side.Allied)
        })

        it('is French when they hold a green, a red and a black star and the Allies no blue one', () => {
            expect(winner([frenchCorps(THREE_STARS)], true)).toBe(Side.French)
        })

        it('is Allied when the French lack one of the three colours', () => {
            expect(winner([frenchCorps(RED_AND_BLACK_STARS)], true)).toBe(Side.Allied)
        })

        it('is Allied when they hold a blue star, whatever the French hold', () => {
            expect(winner([frenchCorps(THREE_STARS), alliedCorps(BLUE_STAR)], true)).toBe(
                Side.Allied
            )
        })
    })

    describe('holding an objective', () => {
        it('takes a corps with infantry or artillery in it', () => {
            expect(winner([alliedCorps(BLUE_STAR, artillery())])).toBe(Side.Allied)
            expect(winner([alliedCorps(BLUE_STAR, cavalry(3))])).toBe(Side.French)
        })

        it('is not done by a detached unit', () => {
            const detached = { ...alliedCorps(BLUE_STAR), commanderId: undefined }
            expect(winner([detached])).toBe(Side.French)
        })

        it('needs a main-road entry of its own army that the enemy does not occupy', () => {
            const [first, second] = ALLIED_MAIN_ROAD_ENTRIES
            expect(winner([alliedCorps(BLUE_STAR), picket(Side.French, first)])).toBe(Side.Allied)
            expect(
                winner([
                    alliedCorps(BLUE_STAR),
                    picket(Side.French, first),
                    picket(Side.French, second)
                ])
            ).toBe(Side.French)

            const contested = [alliedCorps(BLUE_STAR), frenchCorps(THREE_STARS)]
            expect(winner(contested)).toBe(Side.French)
            expect(winner([...contested, picket(Side.Allied, FRENCH_MAIN_ROAD_ENTRY)])).toBe(
                Side.Allied
            )
        })

        it('needs a road to that entry clear of enemy pieces', () => {
            const contested = [alliedCorps(BLUE_STAR), frenchCorps(THREE_STARS)]
            expect(winner([...contested, picket(Side.Allied, ONLY_ROAD_FROM_THREE_STARS)])).toBe(
                Side.Allied
            )
        })
    })
})

describe('the objectives an army holds, as a player sees them (rule 16)', () => {
    const garrison = (side: Side, locale: number, face: Face): PiecePlacement => ({
        id: `${side}-garrison`,
        side,
        face,
        locale,
        commanderId: side === Side.French ? 'lannes' : 'bagration'
    })

    function holdsSeenBy(game: TestGame, viewerSide: Side, armySide: Side) {
        return objectiveHolds(game.seenBy(viewerSide), game.playerOf(armySide))
    }

    it('lists the stars each army is scored on, held where its own player knows a corps holds them', () => {
        const game = frenchTurn([garrison(Side.French, RED_AND_BLACK_STARS, infantry(2))])
        expect(holdsSeenBy(game, Side.French, Side.French)).toEqual([
            { star: Star.Green, locales: [] },
            { star: Star.Red, locales: [{ locale: RED_AND_BLACK_STARS, hold: Hold.Held }] },
            { star: Star.Black, locales: [{ locale: RED_AND_BLACK_STARS, hold: Hold.Held }] }
        ])
        expect(holdsSeenBy(game, Side.French, Side.Allied)).toEqual([
            { star: Star.Blue, locales: [] }
        ])
    })

    it('leaves a hold the enemy cannot see the faces of as possible, until a face shows', () => {
        const game = frenchTurn([garrison(Side.Allied, BLUE_STAR, infantry(2))])
        expect(holdsSeenBy(game, Side.French, Side.Allied)).toEqual([
            { star: Star.Blue, locales: [{ locale: BLUE_STAR, hold: Hold.Possible }] }
        ])
        game.arrange((state) => {
            state.revealAll(state.units)
        })
        expect(holdsSeenBy(game, Side.French, Side.Allied)).toEqual([
            { star: Star.Blue, locales: [{ locale: BLUE_STAR, hold: Hold.Held }] }
        ])
    })

    it('never counts a corps its own player knows to be all cavalry', () => {
        const game = frenchTurn([garrison(Side.Allied, BLUE_STAR, cavalry(2))])
        expect(holdsSeenBy(game, Side.Allied, Side.Allied)).toEqual([
            { star: Star.Blue, locales: [] }
        ])
    })

    it('drops a hold whose road back is cut, whoever is looking', () => {
        const game = frenchTurn([
            garrison(Side.French, THREE_STARS, infantry(2)),
            {
                id: 'A-picket',
                side: Side.Allied,
                face: cavalry(2),
                locale: ONLY_ROAD_FROM_THREE_STARS
            }
        ])
        for (const viewer of [Side.French, Side.Allied]) {
            expect(
                holdsSeenBy(game, viewer, Side.French).every(({ locales }) => locales.length === 0)
            ).toBe(true)
        }
    })
})
