import type { GameAction } from '@tabletop/common'
import { startsFinalTurns } from './historyEntries.js'
import {
    isChooseLarvaCubes,
    isEatCoral,
    isEndGame,
    isExchangeConsumedPolyp,
    isExchangeLarvaCube,
    isFeedParrotfish,
    isIntroduceShrimp,
    isMoveShrimp,
    isPassFinalTurn,
    isPlacePolyp,
    isPlayAlgaCylinder,
    isPlayLarvaCube,
    isRefillOpenSea,
    isSearchBag,
    isTakeOpenSeaSpace,
    type AlgaColor,
    type CoralColor
} from '@tabletop/reef-encounter'

// A phrase reads as a sentence (`text`, for screen readers and tests) and shows as a line of
// words and component icons (`parts`), each icon standing in for the words of its label.
export type PhraseIcon = { label: string } & (
    | { icon: 'polyp'; color: CoralColor; count: number; consumed?: boolean }
    | { icon: 'unseen-polyp' }
    | { icon: 'cube'; color: CoralColor; count: number }
    | { icon: 'cylinder'; alga: AlgaColor }
    | { icon: 'board'; boardId: number }
    | { icon: 'parrotfish' }
)
// Words may show shorter than they read, where the icons around them carry the meaning.
export type PhraseWords = string | { text: string; short: string }
export type PhrasePart = PhraseWords | PhraseIcon
export type Phrase = { text: string; parts: PhrasePart[]; playerId?: string }

const listed = (words: readonly string[]): string =>
    words.length <= 1
        ? (words[0] ?? '')
        : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

export const withArticle = (word: string): string => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`

const counted = (count: number, word: string) =>
    count === 1 ? withArticle(word) : `${count === 2 ? 'two' : count} ${word}s`

const polyp = (color: CoralColor, count = 1, consumed = false): PhraseIcon => ({
    icon: 'polyp',
    color,
    count,
    consumed,
    label: counted(count, `${consumed ? 'consumed ' : ''}${color} polyp`).replace(/^two /, '2 ')
})

const polypsOf = (colors: readonly CoralColor[]): PhraseIcon[] => {
    const counts = new Map<CoralColor, number>()
    for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1)
    return [...counts].map(([color, count]) => polyp(color, count))
}

const polypsLabel = (colors: readonly CoralColor[]): string =>
    colors.length === 1 ? `${withArticle(colors[0])} polyp` : `${listed(colors)} polyps`

const cube = (color: CoralColor, count = 1): PhraseIcon => ({
    icon: 'cube',
    color,
    count,
    label: counted(count, `${color} larva cube`)
})

const board = (boardId: number): PhraseIcon => ({
    icon: 'board',
    boardId,
    label: `board ${boardId}`
})

const parrotfish = (own: 'your' | 'their'): PhraseIcon => ({
    icon: 'parrotfish',
    label: `${own} parrotfish`
})

function phraseText(parts: readonly PhrasePart[]): string {
    return parts
        .map((part) => (typeof part === 'string' ? part : 'icon' in part ? part.label : part.text))
        .join('')
}

// A phrase whose sentence differs from its parts' labels where icons cannot say it alike.
function phrase(parts: PhrasePart[], text = phraseText(parts)): Omit<Phrase, 'playerId'> {
    return { text, parts }
}

// Undefined for actions the history leaves out.
export function describeAction(
    action: GameAction,
    own: 'your' | 'their'
): Omit<Phrase, 'playerId'> | undefined {
    if (isFeedParrotfish(action)) {
        return phrase([
            'fed ',
            action.color ? polyp(action.color) : { icon: 'unseen-polyp', label: 'a polyp' },
            ' to ',
            parrotfish(own),
            '.'
        ])
    }
    if (isChooseLarvaCubes(action)) {
        const [first, second] = action.colors
        return first === second
            ? phrase(['took ', cube(first, 2), '.'])
            : phrase(
                  ['took ', cube(first), ' ', cube(second), '.'],
                  `took ${withArticle(first)} and ${withArticle(second)} larva cube.`
              )
    }
    if (isPlayLarvaCube(action)) {
        return phrase(['played ', cube(action.color), '.'])
    }
    if (isPlacePolyp(action)) {
        const placement = action.metadata
        if (!placement) return undefined
        const parts = placedPolyps(1, placement.color, action.boardId, action.fromConsumed)
        if (placement.attacked) {
            parts.push(', consuming ', polyp(placement.attacked))
        }
        if (placement.extraGrowth) {
            parts.push(
                { text: '; a bonus ', short: '; bonus ' },
                { ...polyp(placement.color), label: `${placement.color} polyp` },
                { text: ' grew beside it', short: '' }
            )
        }
        parts.push('.')
        return phrase(parts)
    }
    if (isIntroduceShrimp(action)) {
        return phrase(['introduced a shrimp on ', board(action.boardId), '.'])
    }
    if (isMoveShrimp(action)) {
        if (!action.to) {
            return phrase([`took a shrimp back to ${own} supply.`])
        }
        return action.to.boardId === action.from.boardId
            ? phrase(['moved a shrimp.'])
            : phrase(['moved a shrimp to ', board(action.to.boardId), '.'])
    }
    if (isExchangeConsumedPolyp(action)) {
        return phrase([
            'traded ',
            polyp(action.color, 1, true),
            { text: ' for ', short: ' → ' },
            cube(action.color),
            '.'
        ])
    }
    if (isExchangeLarvaCube(action)) {
        if (action.metadata?.searchesBag) {
            return phrase([
                'reached into the bag to trade ',
                cube(action.color),
                { text: ' for ', short: ' → ' },
                polyp(action.color),
                '.'
            ])
        }
        return phrase([
            'traded ',
            cube(action.color),
            { text: ' for ', short: ' → ' },
            polyp(action.color),
            '.'
        ])
    }
    if (isPlayAlgaCylinder(action)) {
        const flipped = action.metadata?.flippedTileIds.length ?? 0
        const flips =
            flipped === 0 ? '' : `, flipping ${flipped} coral tile${flipped === 1 ? '' : 's'}`
        const cylinder: PhraseIcon = {
            icon: 'cylinder',
            alga: action.alga,
            label: `${withArticle(action.alga)} cylinder`
        }
        return action.tileId === undefined
            ? phrase(['put ', cylinder, ` on the open sea${flips}.`])
            : phrase([`locked coral tile ${action.tileId} with `, cylinder, `${flips}.`])
    }
    if (isEatCoral(action)) {
        const eaten = action.metadata
        if (!eaten) return undefined
        return phrase([
            'fed a coral of ',
            { ...polyp(eaten.color, eaten.polyps), label: `${eaten.polyps} ${eaten.color} polyps` },
            ' to ',
            parrotfish(own),
            {
                text: `, ${eaten.returnedToBag} of them going back into the bag.`,
                short: `, ${eaten.returnedToBag} back to the bag.`
            }
        ])
    }
    if (isTakeOpenSeaSpace(action)) {
        const taken = action.metadata?.polyps ?? []
        const larva = cube(action.larvaColor)
        const text =
            taken.length === 0
                ? `took the ${action.larvaColor} larva cube from the open sea.`
                : `took the ${action.larvaColor} larva cube from the open sea with ${polypsLabel(taken)}.`
        return phrase(
            [
                'took ',
                larva,
                ' from the open sea',
                ...(taken.length > 0 ? [' with ', ...polypsOf(taken)] : []),
                '.'
            ],
            text
        )
    }
    if (isPassFinalTurn(action)) {
        return phrase([`passed ${own} final turn.`])
    }
    return undefined
}

export function describeSystemAction(action: GameAction): Omit<Phrase, 'playerId'> | undefined {
    if (isRefillOpenSea(action)) {
        const refill = action.metadata
        if (!refill) return undefined
        if (refill.shortage) {
            return phrase(['The open sea could not be refilled.'])
        }
        const added = refill.additions.map((addition) => addition.polyp)
        return added.length === 0
            ? phrase(['The open sea was refilled.'])
            : phrase(
                  ['The open sea was refilled with ', ...polypsOf(added), '.'],
                  `The open sea was refilled with ${polypsLabel(added)}.`
              )
    }
    if (isSearchBag(action)) {
        const found = action.metadata?.found
        if (found === undefined) return undefined
        const searched = polyp(action.color)
        if (!found) {
            const outcome =
                action.need.kind === 'exchange' ? 'the cube stays' : 'nothing grew there'
            return phrase([
                'The bag held no ',
                { ...searched, label: `${action.color} polyp` },
                `, so ${outcome}.`
            ])
        }
        return action.need.kind === 'exchange'
            ? phrase(['The bag held ', searched, '.'])
            : phrase([
                  'The bag held ',
                  searched,
                  `, which grew beside it on `,
                  board(action.need.boardId),
                  '.'
              ])
    }
    if (isEndGame(action)) {
        return phrase(['The game ended.'])
    }
    return undefined
}

function setupParrotfishPhrases(action: GameAction, possessive: (playerId: string) => string) {
    const revealed = isEndGame(action) ? (action.metadata?.setupParrotfishPolyps ?? []) : []
    return revealed.map(({ playerId, color }) => ({
        ...phrase([`${possessive(playerId)} parrotfish had been fed `, polyp(color), ' at setup.']),
        playerId
    }))
}

function placedPolyps(
    count: number,
    color: CoralColor,
    boardId: number,
    consumed: boolean
): PhrasePart[] {
    const placed = polyp(color, count, consumed)
    return [
        'placed ',
        count === 1
            ? placed
            : { ...placed, label: `${count} ${consumed ? 'consumed ' : ''}${color} polyps` },
        ' on ',
        board(boardId)
    ]
}

// Consecutive plain placements of one colour on one board merge into one phrase.
export function describeActions(
    actions: readonly GameAction[],
    own: 'your' | 'their',
    possessive: (playerId: string) => string
): Phrase[] {
    const phrases: Phrase[] = []
    let run:
        | {
              key: string
              playerId?: string
              count: number
              color: CoralColor
              boardId: number
              consumed: boolean
          }
        | undefined
    const closeRun = () => {
        if (run) {
            const parts = [...placedPolyps(run.count, run.color, run.boardId, run.consumed), '.']
            phrases.push({ ...phrase(parts), playerId: run.playerId })
        }
        run = undefined
    }
    for (const action of actions) {
        const placement = isPlacePolyp(action) ? action.metadata : undefined
        if (isPlacePolyp(action) && placement && !placement.attacked && !placement.extraGrowth) {
            const key = `${action.playerId}:${placement.color}:${action.boardId}:${action.fromConsumed}`
            if (run?.key === key) {
                run.count += 1
                continue
            }
            closeRun()
            run = {
                key,
                playerId: action.playerId,
                count: 1,
                color: placement.color,
                boardId: action.boardId,
                consumed: action.fromConsumed
            }
            continue
        }
        closeRun()
        const described = action.playerId
            ? describeAction(action, own)
            : describeSystemAction(action)
        if (described) phrases.push({ ...described, playerId: action.playerId })
        phrases.push(...setupParrotfishPhrases(action, possessive))
        if (startsFinalTurns(action)) {
            phrases.push(phrase(['That ends the game: every other player has one final turn.']))
        }
    }
    closeRun()
    return phrases
}

export function capitalised(phrase: string): string {
    return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}
