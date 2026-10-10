import { describe, expect, it } from 'vitest'
import { Visibility } from '@tabletop/common'
import { Side } from '../components/pieces.js'
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

    it('keeps the defense leading units from the attacker until the attack is pressed', () => {
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
        game.act(ActionType.ThreatenAttack, french, {
            approach: game.hydrated.map.approachBetween(95, 108).id
        })
        const [defense] = game.act(ActionType.DeclareDefense, allied, {
            unitIds: ['A-inf', 'A-cav'],
            leaderIds: ['A-cav']
        })
        const toAttacker = NapoleonsTriumphRuntime.visibility.actions.project(defense, {
            kind: 'player',
            playerId: french
        })
        expect(toAttacker).toHaveProperty('unitIds')
        expect(toAttacker).not.toHaveProperty('leaderIds')
        const attackerView = project(game, { kind: 'player', playerId: french })
        expect(attackerView.attack?.defensePlan).not.toHaveProperty('leaderIds')
        expect(attackerView.attack?.defenseLeaderIds).toEqual([])
        const defenderView = project(game, { kind: 'player', playerId: allied })
        expect(defenderView.attack?.defensePlan?.leaderIds).toEqual(['A-cav'])

        game.act(ActionType.PressAttack, french)
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
