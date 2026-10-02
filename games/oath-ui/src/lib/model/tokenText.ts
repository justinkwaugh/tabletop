import { Suit } from '@tabletop/oath'

/** A run of panel text: words, a favor, secret or warband token with its count, or a suit's symbol. */
export type TextPart =
    | { kind: 'text'; text: string }
    | { kind: 'favor'; count?: number }
    | { kind: 'secret'; count?: number }
    | { kind: 'suit'; suit: Suit; bank: boolean }
    | { kind: 'warband'; count: number; imperial: boolean; words: string }

export interface TokenOptions {
    warbands?: boolean
}

const SUITS = Object.values(Suit)
const SUIT_ALTERNATIVES = SUITS.join('|')
const ONE = new Set(['a', 'an', 'one'])

// The banners' names ("the People's Favor", "the Darkest Secret") stay words; so does "order"
// unless it names the suit's bank or its cards.
const ALTERNATIVES = [
    String.raw`\b(?:the )?(?<bankSuit>${SUIT_ALTERNATIVES}) bank\b`,
    String.raw`\b(?<cardSuit>${SUIT_ALTERNATIVES})(?= (?:advisers?|cards?|denizens?)\b)`,
    String.raw`(?<!people['’]s )\b(?:(?<favorCount>\d+|an?|one) )?favor\b`,
    String.raw`(?<!darkest )\b(?:(?<secretCount>\d+|an?|one) )?secrets?\b`
]
const WARBANDS = String.raw`\b(?<warbandCount>\d+|an?|one) (?<warbandWhose>(?<imperial>Imperial )|of [^,;:—]+?['’]s )?(?<warbandNoun>warbands?)\b`

const PATTERN = new RegExp(ALTERNATIVES.join('|'), 'gi')
const PATTERN_WITH_WARBANDS = new RegExp([WARBANDS, ...ALTERNATIVES].join('|'), 'gi')

function countOf(word: string | undefined): number | undefined {
    if (word === undefined) return undefined
    return ONE.has(word.toLowerCase()) ? 1 : Number(word)
}

function suitNamed(name: string): Suit {
    const suit = SUITS.find((s) => s === name.toLowerCase())
    if (!suit) throw Error(`${name} is not a suit`)
    return suit
}

/** Panel text with favor, secrets and suits as their tokens and symbols, the rest as words. */
export function tokenParts(text: string, options: TokenOptions = {}): TextPart[] {
    const parts: TextPart[] = []
    let from = 0
    for (const match of text.matchAll(options.warbands ? PATTERN_WITH_WARBANDS : PATTERN)) {
        const at = match.index ?? 0
        if (at > from) parts.push({ kind: 'text', text: text.slice(from, at) })
        const groups = match.groups ?? {}
        const { bankSuit, cardSuit, favorCount, secretCount, warbandCount } = groups
        if (warbandCount) {
            parts.push({
                kind: 'warband',
                count: countOf(warbandCount) ?? 1,
                imperial: groups.imperial !== undefined,
                words: `${groups.warbandWhose ?? ''}${groups.warbandNoun}`
            })
        } else if (bankSuit) parts.push({ kind: 'suit', suit: suitNamed(bankSuit), bank: true })
        else if (cardSuit) parts.push({ kind: 'suit', suit: suitNamed(cardSuit), bank: false })
        else if (/favor$/i.test(match[0])) parts.push({ kind: 'favor', count: countOf(favorCount) })
        else parts.push({ kind: 'secret', count: countOf(secretCount) })
        from = at + match[0].length
    }
    if (from < text.length) parts.push({ kind: 'text', text: text.slice(from) })
    return parts
}
