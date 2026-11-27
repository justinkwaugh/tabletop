import { actingOperatingCompany, type EighteenXXState } from '@tabletop/18xx'
import type { TitlePresentation } from '../session/titlePresentation.js'

/**
 * The company the turn header names: a private the title waits on outside any company's turn,
 * else the company operating or next to operate.
 */
export function turnCompanyId<State extends EighteenXXState>(
    state: State,
    presentation: Pick<TitlePresentation<State>, 'turnPrivate'>
): string | undefined {
    return (
        presentation.turnPrivate?.(state) ??
        actingOperatingCompany(state) ??
        state.operatingSet?.companyOrder.find(
            (id) => !state.operatingSet?.completedCompanyIds.includes(id)
        )
    )
}
