import { assert, assertExists } from '@tabletop/common'
import { HydratedOathGameState } from '../model/gameState.js'
import { Region } from '../model/oathEnums.js'
import { PowerQuestionKind } from '../model/question.js'
import { discardCards, type DiscardTarget } from './discard.js'
import { warbandEntries } from './warbands.js'
import { killWarbands, removeWarbandsFromCard } from './force.js'
import { askQuestion } from './questions.js'

export const FALSE_PROPHET_ID = 'denizen.discord.false-prophet'

/** R-5.1.4.III, R-6.6.2 — the id comes back when the Vision went to a pile (R-9.4). */
export function discardRevealedVision(
    state: HydratedOathGameState,
    holderId: string,
    fromRegion: Region,
    target?: DiscardTarget
): string | undefined {
    const holder = state.getPlayerState(holderId)
    const visionId = holder.revealedVisionId
    assertExists(visionId, `${holderId} has no revealed Vision to discard`)
    holder.revealedVisionId = undefined

    const falseProphetPlayerId = killWarbandsOnVision(state, visionId)
    if (falseProphetPlayerId !== undefined) {
        const forced = askQuestion(state, holderId, {
            kind: PowerQuestionKind.PlayOrDiscardVision,
            cardId: FALSE_PROPHET_ID,
            askedPlayerId: falseProphetPlayerId,
            visionCardId: visionId
        })
        assert(forced === undefined, `${visionId} must be played or discarded: ${forced}`)
        return undefined
    }
    discardCards(state, holderId, [visionId], fromRegion, target)
    return visionId
}

/** R-10.13 */
function killWarbandsOnVision(state: HydratedOathGameState, visionId: string): string | undefined {
    let ownerId: string | undefined
    for (const [color, count] of warbandEntries(state.warbandsOnCard(visionId))) {
        if (count <= 0) continue
        removeWarbandsFromCard(state, visionId, color, count)
        killWarbands(state, color, count)
        ownerId ??= state.warbandOwnerOf(color)
    }
    return ownerId
}
