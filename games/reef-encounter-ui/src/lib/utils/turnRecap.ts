import type { GameAction } from '@tabletop/common'
import { isEatCoral, isTakeOpenSeaSpace } from '@tabletop/reef-encounter'
import {
    cube,
    describeAction,
    parrotfish,
    phrase,
    polyp,
    polypsLabel,
    type BoardName,
    type Phrase
} from './actionDescription.js'

// A finished turn: the coral eaten if there was one, then how the turn ended. The History tab
// tells the rest.
export function turnSummary(
    actions: readonly GameAction[],
    own: 'your' | 'their',
    board: BoardName
): Phrase | undefined {
    const eaten = actions.find(isEatCoral)?.metadata
    const ended = turnEnding(actions, own, board)
    if (!eaten) return ended
    const fed = phrase(['fed ', polyp(eaten.color, eaten.polyps), ' to ', parrotfish(own)])
    if (!ended) return fed
    return {
        parts: [...fed.parts, ', then ', ...ended.parts],
        text: `${fed.text}, then ${ended.text}`
    }
}

function turnEnding(
    actions: readonly GameAction[],
    own: 'your' | 'their',
    board: BoardName
): Phrase | undefined {
    const ending = actions.findLast((action) => action.playerId !== undefined)
    if (!ending || isEatCoral(ending)) return undefined
    if (isTakeOpenSeaSpace(ending)) {
        const taken = ending.metadata?.polyps ?? []
        const took = `took the ${ending.larvaColor} larva cube`
        return phrase(
            [
                'took ',
                cube(ending.larvaColor),
                // At most three, so each shows on its own rather than as a count.
                ...(taken.length > 0 ? [' with ', ...taken.map((color) => polyp(color))] : [])
            ],
            taken.length > 0 ? `${took} with ${polypsLabel(taken)}` : took
        )
    }
    const described = describeAction(ending, own, board)
    if (!described) return undefined
    const parts = [...described.parts]
    const last = parts.at(-1)
    if (typeof last === 'string') parts[parts.length - 1] = last.replace(/\.$/, '')
    return { parts, text: described.text.replace(/\.$/, '') }
}
