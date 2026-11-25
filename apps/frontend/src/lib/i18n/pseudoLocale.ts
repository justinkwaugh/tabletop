export const PSEUDO_LOCALE = 'en-XA'

const ACCENTED_LETTERS: Record<string, string> = {
    a: 'á',
    b: 'ƀ',
    c: 'ç',
    d: 'ð',
    e: 'é',
    f: 'ƒ',
    g: 'ĝ',
    h: 'ĥ',
    i: 'î',
    j: 'ĵ',
    k: 'ķ',
    l: 'ļ',
    m: 'ɱ',
    n: 'ñ',
    o: 'ö',
    p: 'þ',
    q: 'ǫ',
    r: 'ŕ',
    s: 'š',
    t: 'ţ',
    u: 'û',
    v: 'ṽ',
    w: 'ŵ',
    x: 'ẋ',
    y: 'ý',
    z: 'ž',
    A: 'Å',
    B: 'Ɓ',
    C: 'Ç',
    D: 'Ð',
    E: 'É',
    F: 'Ƒ',
    G: 'Ĝ',
    H: 'Ĥ',
    I: 'Î',
    J: 'Ĵ',
    K: 'Ķ',
    L: 'Ļ',
    M: 'Ṁ',
    N: 'Ñ',
    O: 'Ö',
    P: 'Þ',
    Q: 'Ǫ',
    R: 'Ŕ',
    S: 'Š',
    T: 'Ţ',
    U: 'Û',
    V: 'Ṽ',
    W: 'Ŵ',
    X: 'Ẋ',
    Y: 'Ý',
    Z: 'Ž'
}

const TRANSLATED_LENGTH_GROWTH = 0.35

export function pseudoLocalizePattern(pattern: string): string {
    let result = ''
    let letters = 0
    let braceDepth = 0
    for (let index = 0; index < pattern.length; index++) {
        const character = pattern[index]
        if (character === '\\' && index + 1 < pattern.length) {
            result += character + pattern[index + 1]
            index++
        } else if (character === '{') {
            braceDepth++
            result += character
        } else if (character === '}') {
            braceDepth--
            result += character
        } else if (braceDepth > 0) {
            result += character
        } else {
            const accented = ACCENTED_LETTERS[character]
            if (accented) letters++
            result += accented ?? character
        }
    }
    return `[${result}${'·'.repeat(Math.ceil(letters * TRANSLATED_LENGTH_GROWTH))}]`
}

export function pseudoLocalizeMessages(messages: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
        Object.entries(messages).map(([key, message]) => [
            key,
            key === '$schema' ? message : pseudoLocalizeMessage(message)
        ])
    )
}

function pseudoLocalizeMessage(message: unknown): unknown {
    if (typeof message === 'string') return pseudoLocalizePattern(message)
    if (Array.isArray(message)) return message.map(pseudoLocalizeVariants)
    return message
}

function pseudoLocalizeVariants(variants: unknown): unknown {
    if (!isRecord(variants) || !isRecord(variants.match)) return variants
    return {
        ...variants,
        match: Object.fromEntries(
            Object.entries(variants.match).map(([selector, pattern]) => [
                selector,
                pseudoLocalizeMessage(pattern)
            ])
        )
    }
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
