import { Suit } from '@tabletop/oath'

export type SentencePart =
    | { kind: 'text'; text: string }
    | { kind: 'suit'; suit: Suit }
    | { kind: 'favor' }
    | { kind: 'secret' }
    | { kind: 'attackDie' }

const SUITS = Object.values(Suit)
const TOKEN = /\[(?:suit:(?<suit>[a-z]+)|(?<symbol>favor|secret|attackDie))\]/g

function suitNamed(name: string): Suit {
    const suit = SUITS.find((s) => s === name)
    if (!suit) throw Error(`${name} is not a suit`)
    return suit
}

function symbolPart(symbol: string): SentencePart {
    if (symbol === 'favor') return { kind: 'favor' }
    if (symbol === 'secret') return { kind: 'secret' }
    return { kind: 'attackDie' }
}

export function sentenceParts(sentence: string): SentencePart[] {
    const parts: SentencePart[] = []
    let from = 0
    for (const match of sentence.matchAll(TOKEN)) {
        const at = match.index ?? 0
        if (at > from) parts.push({ kind: 'text', text: sentence.slice(from, at) })
        const { suit, symbol } = match.groups ?? {}
        parts.push(suit ? { kind: 'suit', suit: suitNamed(suit) } : symbolPart(symbol ?? ''))
        from = at + match[0].length
    }
    if (from < sentence.length) parts.push({ kind: 'text', text: sentence.slice(from) })
    return parts
}
