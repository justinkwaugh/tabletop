import { ActionSource, type GameAction } from '@tabletop/common'
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
    type CoralColor,
    type OpenSeaAddition,
    type OpenSeaRefill
} from '@tabletop/reef-encounter'

// A phrase reads as a sentence (`text`, for screen readers and tests) and shows as a line of
// words and component icons (`parts`), each icon standing in for the words of its label.
export type PhraseIcon = { label: string } & (
    | { icon: 'polyp'; color: CoralColor; count: number; consumed?: boolean }
    | { icon: 'unseen-polyp' }
    | { icon: 'cube'; color: CoralColor; count: number }
    | { icon: 'cylinder'; alga: AlgaColor }
    | { icon: 'parrotfish' }
)
// Words may show shorter than they read, where the icons around them carry the meaning.
export type PhraseWords = string | { text: string; short: string }
export type PhrasePart = PhraseWords | PhraseIcon
export type Phrase = { text: string; parts: PhrasePart[]; playerId?: string }

export const BagSearchLabel = ' from the bag, which can’t be taken back'

const listed = (words: readonly string[]): string =>
    words.length <= 1
        ? (words[0] ?? '')
        : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`

export const withArticle = (word: string): string => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`

const counted = (count: number, word: string) =>
    count === 1 ? withArticle(word) : `${count === 2 ? 'two' : count} ${word}s`

export const polyp = (color: CoralColor, count = 1, consumed = false): PhraseIcon => ({
    icon: 'polyp',
    color,
    count,
    consumed,
    label: counted(count, `${consumed ? 'consumed ' : ''}${color} polyp`).replace(/^two /, '2 ')
})

// Spoken with each colour counted once: "grey and orange polyps", "a white polyp and two yellow
// polyps".
export function polypsLabel(colors: readonly CoralColor[]): string {
    const counts = new Map<CoralColor, number>()
    for (const color of colors) counts.set(color, (counts.get(color) ?? 0) + 1)
    if (counts.size === colors.length) {
        return colors.length === 1 ? `${withArticle(colors[0])} polyp` : `${listed(colors)} polyps`
    }
    return listed([...counts].map(([color, count]) => counted(count, `${color} polyp`)))
}

export const cube = (color: CoralColor, count = 1): PhraseIcon => ({
    icon: 'cube',
    color,
    count,
    label: counted(count, `${color} larva cube`)
})

export type BoardName = (boardId: number) => string

export const parrotfish = (own: 'your' | 'their'): PhraseIcon => ({
    icon: 'parrotfish',
    label: `${own} parrotfish`
})

function phraseText(parts: readonly PhrasePart[]): string {
    return parts
        .map((part) => (typeof part === 'string' ? part : 'icon' in part ? part.label : part.text))
        .join('')
}

// A phrase whose sentence differs from its parts' labels where icons cannot say it alike.
export function phrase(parts: PhrasePart[], text = phraseText(parts)): Omit<Phrase, 'playerId'> {
    return { text, parts }
}

// Undefined for actions the history leaves out.
export function describeAction(
    action: GameAction,
    own: 'your' | 'their',
    board: BoardName
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
        const parts = placedPolyps(1, placement.color, board(action.boardId), action.fromConsumed)
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
        return phrase(
            [
                `ended ${own} turn by taking `,
                cube(action.larvaColor),
                // At most three, so each shows on its own rather than as a count.
                ...(taken.length > 0 ? [' with ', ...taken.map((color) => polyp(color))] : []),
                '.'
            ],
            taken.length === 0
                ? `ended ${own} turn by taking the ${action.larvaColor} larva cube.`
                : `ended ${own} turn by taking the ${action.larvaColor} larva cube with ${polypsLabel(taken)}.`
        )
    }
    if (isPassFinalTurn(action)) {
        return action.source === ActionSource.System
            ? phrase(['had no coral that would score, so passed.'])
            : phrase([`passed ${own} final turn.`])
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
        const told = refillSentences(refill)
        return refill.additions.length === 0
            ? phrase(joinSentences([['The open sea was refilled.'], ...told]))
            : phrase(joinSentences(told))
    }
    if (isSearchBag(action)) {
        const found = action.metadata?.found
        if (found === undefined) return undefined
        const searched = polyp(action.color)
        if (!found) {
            const color = { ...searched, label: `${action.color} polyp` }
            return action.need.kind === 'exchange'
                ? phrase(['The bag held no ', color, ', so the cube stays.'])
                : phrase(['No bonus ', color, ' left in the bag.'])
        }
        return action.need.kind === 'exchange'
            ? phrase(['The bag held ', searched, '.'])
            : phrase([
                  'Bonus ',
                  { ...searched, label: `${action.color} polyp` },
                  ' placed from the bag.'
              ])
    }
    if (isEndGame(action)) {
        return phrase(['The game ended.'])
    }
    return undefined
}

// Each refilled space as "polyp on cube", the cube standing for its larva space.
function refillParts(additions: readonly OpenSeaAddition[]): PhrasePart[] {
    return additions.flatMap((addition, index) => [
        ...(index > 0 ? [', '] : []),
        polyp(addition.polyp),
        { text: ' on the ', short: ' on ' },
        { ...cube(addition.larvaColor), label: `${addition.larvaColor} space` }
    ])
}

function refillSentences(refill: OpenSeaRefill): PhrasePart[][] {
    const refills = refill.bonusRefills ?? []
    const icons = (found: boolean, joiner: string) =>
        refills
            .filter((bonus) => bonus.found === found)
            .flatMap((bonus, index) => [
                ...(index > 0 ? [joiner] : []),
                { ...polyp(bonus.color), label: `${bonus.color} polyp` }
            ])
    const found = icons(true, ', ')
    const missing = icons(false, ' or ')
    return [
        ...(refill.additions.length > 0
            ? [['Refill: ', ...refillParts(refill.additions), '.']]
            : []),
        ...(found.length > 0 ? [['Bonus: ', ...found, '.']] : []),
        ...(missing.length > 0 ? [['No bonus ', ...missing, ' in the bag.']] : [])
    ]
}

const joinSentences = (sentences: readonly PhrasePart[][]): PhrasePart[] =>
    sentences.flatMap((sentence, index) => (index > 0 ? [' ', ...sentence] : sentence))

// What follows on from the action before it, told at the end of that action's phrase:
// the open sea refilled after a turn ends, and a bonus polyp from the bag after a placement.
function continuation(
    action: GameAction,
    previous: GameAction | undefined
): PhrasePart[] | undefined {
    if (isRefillOpenSea(action) && isTakeOpenSeaSpace(previous)) {
        const refill = action.metadata
        if (!refill || refill.shortage) return undefined
        const told = refillSentences(refill)
        return told.length > 0 ? ['. ', ...joinSentences(told)] : undefined
    }
    if (isSearchBag(action) && action.need.kind === 'extraGrowth' && isPlacePolyp(previous)) {
        const found = action.metadata?.found
        if (found === undefined) return undefined
        const color = { ...polyp(action.color), label: `${action.color} polyp` }
        return found
            ? ['; bonus ', color, ' from the bag.']
            : ['; no bonus ', color, ' left in the bag.']
    }
    return undefined
}

// The phrase with more told at its end, in place of its closing full stop.
function extended(base: Phrase, more: PhrasePart[]): Phrase {
    const parts = [...base.parts]
    const last = parts.at(-1)
    if (last === '.') parts.pop()
    const joined = [...parts, ...more]
    return { ...base, parts: joined, text: base.text.replace(/\.$/, '') + phraseText(more) }
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
    boardName: string,
    consumed: boolean
): PhrasePart[] {
    const placed = polyp(color, count, consumed)
    return [
        'placed ',
        count === 1
            ? placed
            : { ...placed, label: `${count} ${consumed ? 'consumed ' : ''}${color} polyps` },
        ' on ',
        boardName
    ]
}

// Consecutive plain placements of one colour on one board merge into one phrase.
export function describeActions(
    actions: readonly GameAction[],
    own: 'your' | 'their',
    possessive: (playerId: string) => string,
    board: BoardName
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
            const parts = [
                ...placedPolyps(run.count, run.color, board(run.boardId), run.consumed),
                '.'
            ]
            phrases.push({ ...phrase(parts), playerId: run.playerId })
        }
        run = undefined
    }
    let previous: GameAction | undefined
    for (const action of actions) {
        const before = previous
        previous = action
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
        const more = continuation(action, before)
        const last = phrases.at(-1)
        if (more && last) {
            phrases[phrases.length - 1] = extended(last, more)
            continue
        }
        const described = action.playerId
            ? describeAction(action, own, board)
            : describeSystemAction(action)
        if (described) phrases.push({ ...described, playerId: action.playerId })
        phrases.push(...setupParrotfishPhrases(action, possessive))
        if (startsFinalTurns(action)) {
            phrases.push(phrase(['That ends the game: everyone else may eat a final coral.']))
        }
    }
    closeRun()
    return phrases
}

export function capitalised(phrase: string): string {
    return phrase.charAt(0).toUpperCase() + phrase.slice(1)
}
