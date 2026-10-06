import { expectTypeOf, it } from 'vitest'
import type { EighteenSeventeenState, HydratedEighteenSeventeenState } from '@tabletop/1817'
import type { EighteenXXSessionView } from '@tabletop/18xx-ui'
import type { GameSessionView } from '@tabletop/frontend-components'
import type { EighteenSeventeenSession } from './session.svelte.js'

it('retains title state while satisfying shared control interfaces', () => {
    expectTypeOf<
        EighteenSeventeenSession['gameState']
    >().toEqualTypeOf<HydratedEighteenSeventeenState>()
    expectTypeOf<
        ReturnType<EighteenSeventeenSession['gameState']['dehydrate']>
    >().toEqualTypeOf<EighteenSeventeenState>()
    expectTypeOf<
        EighteenSeventeenSession['history']['visibleContext']['state']
    >().toEqualTypeOf<EighteenSeventeenState>()
    expectTypeOf<EighteenSeventeenSession['gameState']>().toHaveProperty('mergerRound')
    expectTypeOf<EighteenSeventeenSession['gameState']>().not.toHaveProperty('mergerRoud')
    expectTypeOf<EighteenSeventeenSession>().toExtend<EighteenXXSessionView>()
    expectTypeOf<EighteenSeventeenSession>().toExtend<GameSessionView>()
})
