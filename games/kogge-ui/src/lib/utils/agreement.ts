const IRREGULAR: Record<string, string> = { has: 'have', does: 'do', is: 'are' }

// "Anna sails from Riga, a city they raided" reads "You sail from Riga, a city you raided".
export function addressReader(phrase: string): string {
    const replaced = phrase
        .replace(/\btheir\b/g, 'your')
        .replace(/\bthey\b/g, 'you')
        .replace(/\bthem\b/g, 'you')
    const match = /^(\s*)([a-z]+)(.*)$/s.exec(replaced)
    if (!match) {
        return replaced
    }
    const [, space, verb, rest] = match
    return `${space}${baseForm(verb)}${rest}`
}

function baseForm(verb: string): string {
    if (IRREGULAR[verb]) return IRREGULAR[verb]
    if (verb === 'cannot' || verb === 'and' || !verb.endsWith('s')) return verb
    if (/(ches|shes|sses|xes)$/.test(verb)) return verb.slice(0, -2)
    return verb.slice(0, -1)
}
