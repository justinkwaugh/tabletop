import { describe, expect, it } from 'vitest'
import { exampleGame } from '@tabletop/18xx/scenarios'
import { Scenarios1846 } from '@tabletop/1846/scenarios'
import { EighteenThirtyScenarios } from '@tabletop/1830/scenarios'
import { EighteenSeventeenScenarios } from '@tabletop/1817/scenarios'
import { ActionSource, createAction } from '@tabletop/common'
import { FinishTrack, nextOperatingCompany } from '@tabletop/18xx'
import { loadCompatibleExample } from './loadCompatibleExample.js'

describe('saved playground examples', () => {
    it('skips an old setup checksum and reuses a valid saved example', async () => {
        const { game, state } = exampleGame(Scenarios1846, 'construction', 3, 1889)
        const stale = {
            game: { ...game, state: { ...state, actionChecksum: 1329191252 } },
            actions: []
        }
        const valid = { game: { ...game, state }, actions: [] }
        expect(
            await loadCompatibleExample([{ id: 'old' }, { id: 'current' }], async (id) =>
                id === 'old' ? stale : valid
            )
        ).toBe(valid)
    })

    it.each([EighteenThirtyScenarios, EighteenSeventeenScenarios])(
        'skips an outdated $info.id canonical state',
        async (definition) => {
            const { game, state, engine } = exampleGame(definition, 'construction', 3, 1889)
            const obsolete = { ...state, obsoleteField: true }
            expect(() => engine.validateCanonicalState(obsolete)).toThrow(
                'Complete canonical state is required'
            )
            expect(
                await loadCompatibleExample([{ id: game.id }], async () => {
                    engine.validateCanonicalState(obsolete)
                    return { game, actions: [] }
                })
            ).toBeUndefined()
        }
    )

    it('preserves valid saved progress with its complete action history', async () => {
        const { game, state, engine } = exampleGame(Scenarios1846, 'construction', 3, 1889)
        const result = engine.executeCanonicalAction({
            game,
            state,
            action: createAction(FinishTrack, {
                id: 'finish-construction',
                gameId: game.id,
                type: 'FinishTrack',
                source: ActionSource.User,
                playerId: state.activePlayerIds[0],
                companyId: nextOperatingCompany(state)
            })
        })
        const saved = {
            game: { ...game, state: result.updatedState },
            actions: result.processedActions.toReversed()
        }
        expect(await loadCompatibleExample([game], async () => saved)).toBe(saved)
        expect(
            await loadCompatibleExample([game], async () => ({ ...saved, actions: [] }))
        ).toBeUndefined()
    })

    it('propagates unrelated loading failures', async () => {
        await expect(
            loadCompatibleExample([{ id: 'unreadable' }], async () => {
                throw new Error('Storage unavailable')
            })
        ).rejects.toThrow('Storage unavailable')
    })
})
