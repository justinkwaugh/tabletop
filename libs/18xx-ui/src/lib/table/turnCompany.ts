import type { GameAction } from '@tabletop/common'
import { actingOperatingCompany, type EighteenXXState } from '@tabletop/18xx'
import type { TitlePresentation } from '../session/titlePresentation.js'

/**
 * The company the turn header names: the private the title names for the turn, else the company
 * operating or next to operate.
 */
export function turnCompanyId<State extends EighteenXXState>(
    state: State,
    presentation: Pick<TitlePresentation<State>, 'turnPrivateId'>,
    viewedAction?: GameAction
): string | undefined {
    return presentation.turnPrivateId?.(state, viewedAction) ?? actingOperatingCompany(state)
}
