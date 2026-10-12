import { describe, expect, it } from 'vitest'
import { NapoleonsTriumphRuntime, Side, suggestedDeployment } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { showsArmyOf } from './armyInView.js'

function viewOf(game: TestGame, side: Side) {
    return NapoleonsTriumphRuntime.hydrator.hydrateState(
        NapoleonsTriumphRuntime.visibility.state.project(
            game.canonical,
            { kind: 'player', playerId: game.playerOf(side) },
            { config: game.game.config }
        )
    )
}

describe('whose army a state shows', () => {
    it('shows a player their own army and hides the other', () => {
        const game = new TestGame()
        const view = viewOf(game, Side.Allied)
        expect(showsArmyOf(view, game.playerOf(Side.Allied))).toBe(true)
        expect(showsArmyOf(view, game.playerOf(Side.French))).toBe(false)
    })

    it('shows both armies in the full state an administrator is given', () => {
        const game = new TestGame()
        expect(showsArmyOf(game.hydrated, game.playerOf(Side.Allied))).toBe(true)
        expect(showsArmyOf(game.hydrated, game.playerOf(Side.French))).toBe(true)
    })

    it('is what the rules need before they can set an army up', () => {
        const game = new TestGame()
        const view = viewOf(game, Side.Allied)
        expect(() => suggestedDeployment(view, Side.Allied)).not.toThrow()
        expect(() => suggestedDeployment(view, Side.French)).toThrow(
            'The face of unit F01 is not known'
        )
    })
})
