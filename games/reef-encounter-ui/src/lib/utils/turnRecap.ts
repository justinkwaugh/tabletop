import type { GameAction } from '@tabletop/common'
import {
    ActionType,
    isEatCoral,
    isMoveShrimp,
    isTakeOpenSeaSpace,
    type ReefSquare
} from '@tabletop/reef-encounter'
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

// A finished turn in one sentence: the coral fed to the parrotfish if there was one, how many
// other actions the turn took, and how it ended: "fed 8 pink polyps to their parrotfish, took 3
// actions, and took the grey larva cube with …". The History tab tells the rest.
export function turnSummary(
    actions: readonly GameAction[],
    own: 'your' | 'their',
    board: BoardName
): Phrase | undefined {
    const clauses: Omit<Phrase, 'playerId'>[] = []
    const eaten = actions.find(isEatCoral)?.metadata
    if (eaten) {
        clauses.push(phrase(['fed ', polyp(eaten.color, eaten.polyps), ' to ', parrotfish(own)]))
    }
    const taken = actions.filter(isCountedAction).length + shrimpsMoved(actions)
    if (taken > 0) {
        clauses.push(phrase([`took ${taken} action${taken === 1 ? '' : 's'}`]))
    }
    const ended = turnEnding(actions, own, board)
    if (ended) clauses.push(ended)
    return clauses.length === 0 ? undefined : joined(clauses)
}

// The numbered actions of the player aid that the recap counts: eating and taking from the open
// sea are told on their own, and placing polyps is part of playing a larva cube.
const CountedActions: readonly string[] = [
    ActionType.PlayLarvaCube,
    ActionType.IntroduceShrimp,
    ActionType.ExchangeConsumedPolyp,
    ActionType.ExchangeLarvaCube,
    ActionType.PlayAlgaCylinder
]

function isCountedAction(action: GameAction): boolean {
    return action.playerId !== undefined && CountedActions.includes(action.type)
}

// Each shrimp moved counts once, however many times it moved: a move starting where a moved
// shrimp stopped is that shrimp again.
function shrimpsMoved(actions: readonly GameAction[]): number {
    const at = (square: ReefSquare) => `${square.boardId}:${square.coords.row},${square.coords.col}`
    const stops = new Set<string>()
    let shrimps = 0
    for (const action of actions) {
        if (!isMoveShrimp(action)) continue
        if (!stops.delete(at(action.from))) shrimps += 1
        if (action.to) stops.add(at(action.to))
    }
    return shrimps
}

// "A", "A and B", or "A, B, and C".
function joined(clauses: readonly Omit<Phrase, 'playerId'>[]): Omit<Phrase, 'playerId'> {
    const separator = (index: number) =>
        index === 0
            ? ''
            : index < clauses.length - 1
              ? ', '
              : clauses.length > 2
                ? ', and '
                : ' and '
    return {
        parts: clauses.flatMap((clause, index) => [
            ...(index === 0 ? [] : [separator(index)]),
            ...clause.parts
        ]),
        text: clauses.map((clause, index) => `${separator(index)}${clause.text}`).join('')
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
