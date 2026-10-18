import type { GameAction } from '@tabletop/common'
import { isEatCoral, isTakeOpenSeaSpace, type CoralColor } from '@tabletop/reef-encounter'
import {
    describeAction,
    polypsLabel,
    type BoardName,
    type Phrase,
    type PhraseIcon,
    type PhrasePart
} from './actionDescription.js'

type PolypIcon = Extract<PhraseIcon, { icon: 'polyp' }>

const polyp = (color: CoralColor, count: number): PolypIcon => ({
    icon: 'polyp',
    color,
    count,
    label: `${count} ${color} polyp${count === 1 ? '' : 's'}`
})

const phrase = (parts: PhrasePart[], text?: string): Phrase => ({
    parts,
    text:
        text ??
        parts
            .map((part) =>
                typeof part === 'string' ? part : 'icon' in part ? part.label : part.text
            )
            .join('')
})

// One line for a finished turn: the coral eaten if there was one, otherwise how the turn ended.
// The History tab tells the rest.
export function turnSummary(
    actions: readonly GameAction[],
    own: 'your' | 'their',
    board: BoardName
): Phrase | undefined {
    const eaten = actions.find(isEatCoral)?.metadata
    if (eaten) {
        return phrase([
            'fed ',
            polyp(eaten.color, eaten.polyps),
            ' to ',
            { icon: 'parrotfish', label: `${own} parrotfish` }
        ])
    }
    const ending = actions.findLast((action) => action.playerId !== undefined)
    if (!ending) return undefined
    if (isTakeOpenSeaSpace(ending)) {
        const taken = ending.metadata?.polyps ?? []
        const took = `took the ${ending.larvaColor} larva cube`
        return phrase(
            [
                'took ',
                {
                    icon: 'cube',
                    color: ending.larvaColor,
                    count: 1,
                    label: `the ${ending.larvaColor} larva cube`
                },
                // At most three, so each shows on its own rather than as a count.
                ...(taken.length > 0
                    ? [
                          ' with ',
                          ...taken.map((color) => ({ ...polyp(color, 1), label: `${color} polyp` }))
                      ]
                    : [])
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
