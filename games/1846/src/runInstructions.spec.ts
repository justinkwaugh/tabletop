import { expect, it } from 'vitest'
import { ActionSource, type GameAction } from '@tabletop/common'
import { declaredRunInstructionFor, instructableCompanyIds } from '@tabletop/18xx'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { OperatingRules1846 } from './operating.js'
import { Scenarios1846 } from './scenarios/index.js'
import { CanonicalValidator, hydrateEighteenFortySixState } from './state.js'

it('keeps a run instruction declared out of turn through saving and loading', () => {
    const { game, engine, state } = exampleGame(Scenarios1846, 'operations', 3, 1889)
    const [playerId, companyId] = game.players.flatMap((player) =>
        state.activePlayerIds.includes(player.id)
            ? []
            : instructableCompanyIds(state, OperatingRules1846, player.id).map(
                  (id) => [player.id, id] as const
              )
    )[0]
    const declaration: GameAction = {
        id: 'declare',
        gameId: game.id,
        source: ActionSource.User,
        type: 'SetRunInstruction',
        playerId,
        outOfTurn: true,
        supersedable: true,
        supersessionScope: 'companyId',
        companyId,
        instruction: { payout: 'pay', run: { routes: [], key: 'k' } }
    }
    const { updatedState } = engine.executeCanonicalAction({ game, state, action: declaration })
    expect(CanonicalValidator.Check(updatedState)).toBe(true)
    const reloaded = hydrateEighteenFortySixState(structuredClone(updatedState)).dehydrate()
    expect(declaredRunInstructionFor(reloaded, companyId)?.playerId).toBe(playerId)
})
