// History is told of players in the third person; a line about the viewer, shown with "You", is
// told in the second. These turn a phrase written for another player into one for the viewer.

const IRREGULAR: Record<string, string> = { has: 'have', is: 'are', was: 'were', does: 'do' }

// "earns 2 IP" → "earn 2 IP", "has nothing" → "have nothing", "fulfils" → "fulfil",
// "pays" → "pay", "discards their hand" → "discard their hand". Only the first word changes.
export function verbFor(you: boolean, phrase: string): string {
    if (!you) return phrase
    const [first, ...rest] = phrase.split(' ')
    const base =
        IRREGULAR[first] ??
        (/(ss|sh|ch|x|z)es$/.test(first)
            ? first.slice(0, -2)
            : /[^aeiou]ies$/.test(first)
              ? `${first.slice(0, -3)}y`
              : first.endsWith('s') && !first.endsWith('ss')
                ? first.slice(0, -1)
                : first)
    return [base, ...rest].join(' ')
}

// "their" → "your" and "they" → "you", as whole words.
export function pronounsFor(you: boolean, phrase: string): string {
    if (!you) return phrase
    return phrase.replace(/\btheir\b/g, 'your').replace(/\bthey\b/g, 'you')
}

// Both: a phrase about a player, told to them when they are the viewer.
export function toPlayer(you: boolean, phrase: string): string {
    return pronounsFor(you, verbFor(you, phrase))
}
