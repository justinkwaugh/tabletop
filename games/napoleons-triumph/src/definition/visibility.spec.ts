import { describe, expect, it } from 'vitest'
import { Visibility } from '@tabletop/common'
import { Side } from '../components/pieces.js'
import { CommandKind, DefenseAwaits } from '../model/attack.js'
import { NapoleonsTriumphProjectedStateValidator } from '../model/gameState.js'
import { TestGame, arrangeBattlefield, cavalry, infantry } from '../testing/harness.js'
import { ActionType } from './actions.js'
import { NapoleonsTriumphRuntime } from './runtime.js'

const spectator = { kind: 'spectator' } as const

function project(
    game: TestGame,
    perspective: { kind: 'player'; playerId: string } | typeof spectator
) {
    return NapoleonsTriumphRuntime.visibility.state.project(game.canonical, perspective, {
        config: game.game.config
    })
}

describe("Napoleon's Triumph hidden blocks", () => {
    it('shows each player only the faces of their own blocks', () => {
        const game = new TestGame()
        game.deployBoth()
        const french = game.playerOf(Side.French)
        const view = project(game, { kind: 'player', playerId: french })
        expect(NapoleonsTriumphProjectedStateValidator.Check(view)).toBe(true)
        for (const unit of view.units) {
            if (unit.playerId === french) {
                expect(unit.face).toBeDefined()
            } else {
                expect(unit).not.toHaveProperty('face')
            }
        }
        const watching = project(game, spectator)
        const known = watching.units.filter((unit) => 'face' in unit)
        expect(known).toEqual([])
        expect(watching.units.filter((unit) => unit.shown)).toHaveLength(1)
        expect(watching).not.toHaveProperty('masterSeed')
    })

    it('keeps positions, corps and counts public', () => {
        const game = new TestGame()
        game.deployBoth()
        const view = project(game, { kind: 'player', playerId: game.playerOf(Side.French) })
        const hydrated = NapoleonsTriumphRuntime.hydrator.hydrateState(view)
        expect(hydrated.corpsUnits('langeron').length).toBeGreaterThan(0)
        expect(hydrated.commander('langeron').position).toEqual({ locale: 106 })
    })

    it('hides the deployment action from the other player', () => {
        const game = new TestGame()
        const [deployed] = game.deploy(Side.Allied)
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        const projector = NapoleonsTriumphRuntime.visibility.actions
        const toEnemy = projector.project(deployed, { kind: 'player', playerId: french })
        expect(Visibility.isRedactedAction(toEnemy)).toBe(true)
        expect(toEnemy).not.toHaveProperty('deployment')
        const toOwner = projector.project(deployed, { kind: 'player', playerId: allied })
        expect(toOwner).toHaveProperty('deployment')
    })

    it('keeps what the attacker means to attack with to the attacker alone', () => {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: 95 },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: 108 }
        ])
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        const approach = game.hydrated.map.approachBetween(95, 108).id
        const plan = { kind: CommandKind.Unit, unitIds: ['F-inf'] }
        expect(() =>
            game.act(ActionType.ThreatenAttack, french, {
                approach,
                plan: { kind: CommandKind.Unit, unitIds: ['A-inf'] }
            })
        ).toThrow(/own units/)

        const [threat] = game.act(ActionType.ThreatenAttack, french, { approach, plan })
        const toDefender = NapoleonsTriumphRuntime.visibility.actions.project(threat, {
            kind: 'player',
            playerId: allied
        })
        expect(toDefender).toHaveProperty('approach', approach)
        expect(toDefender).not.toHaveProperty('plan')
        expect(project(game, { kind: 'player', playerId: allied }).attack?.attackPlan).toEqual({
            playerId: french
        })
        expect(
            project(game, { kind: 'player', playerId: french }).attack?.attackPlan?.order
        ).toEqual(plan)
    })

    it('shows the defense leading units to nobody until the defender names them, after the attack is pressed', () => {
        const game = new TestGame()
        game.deployBoth()
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        arrangeBattlefield(game, [
            { id: 'F-inf', side: Side.French, face: infantry(3), locale: 95 },
            { id: 'A-inf', side: Side.Allied, face: infantry(2), locale: 108, facing: 95 },
            { id: 'A-cav', side: Side.Allied, face: cavalry(2), locale: 108, facing: 95 }
        ])
        const french = game.playerOf(Side.French)
        const allied = game.playerOf(Side.Allied)
        const [, defense] = game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(95, 108).id
        })
        expect(defense.type).toBe(ActionType.DeclareDefense)
        const toAttacker = NapoleonsTriumphRuntime.visibility.actions.project(defense, {
            kind: 'player',
            playerId: french
        })
        expect(toAttacker).toHaveProperty('unitIds')

        game.act(ActionType.PressAttack, french)
        for (const playerId of [french, allied]) {
            const view = project(game, { kind: 'player', playerId })
            expect(view.attack?.defenseLeaderIds).toEqual([])
            expect(view.attack?.awaits).toBe(DefenseAwaits.Leaders)
        }
        const beforeTheyAreNamed = project(game, { kind: 'player', playerId: french })
        expect(beforeTheyAreNamed.units.find((unit) => unit.id === 'A-cav')).not.toHaveProperty(
            'shown'
        )

        game.act(ActionType.LeadDefense, allied, { leaderIds: ['A-cav'] })
        const pressed = project(game, { kind: 'player', playerId: french })
        expect(pressed.attack?.defenseLeaderIds).toEqual(['A-cav'])
        expect(pressed.units.find((unit) => unit.id === 'A-cav')?.shown).toEqual(cavalry(2))
        expect(pressed.units.find((unit) => unit.id === 'A-inf')).not.toHaveProperty('shown')
    })

    it('forgets what was seen once blocks standing together are shuffled at the end of the turn', () => {
        const game = new TestGame()
        game.deployBoth()
        game.arrange((state) => {
            const [first, second] = state.corpsUnits('langeron')
            state.reveal(first)
            const loner = state.corpsUnits('bagration')[0]
            state.detach(loner)
            loner.position = { locale: 68 }
            state.reveal(loner)
            expect(second.shown).toBeUndefined()
        })
        const loner = game.hydrated.units.find((unit) => unit.position?.locale === 68)
        game.act(ActionType.EndTurn, game.playerOf(Side.Allied))
        const state = game.hydrated
        expect(state.corpsUnits('langeron').every((unit) => unit.shown === undefined)).toBe(true)
        expect(state.unit(loner?.id ?? '').shown).toEqual(loner?.face)
    })
})
