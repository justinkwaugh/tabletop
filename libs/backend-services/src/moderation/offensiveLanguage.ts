import {
    DataSet,
    englishDataset,
    englishRecommendedTransformers,
    parseRawPattern,
    RegExpMatcher
} from 'obscenity'

type Phrase = { patterns: string[]; allowed?: string[] }

const LIBRARY_PHRASES_TO_DROP = [
    'anal',
    'cum',
    'dick',
    'dyke',
    'fag',
    'fuck',
    'hooker',
    'kike',
    'nigger',
    'semen',
    'wank'
]

// The dropped library phrases also match inside `KingGamer`, `FK Austria`, `Dickson`, `Cummings`,
// `Fagan`, `Annalise` and `Fukuda`, which usernames on this site plausibly are.
const NARROWED_PHRASES: Record<string, Phrase> = {
    anal: { patterns: ['|anal|', '|analsex', '|analplug'] },
    cum: { patterns: ['|cum|', '|cums|', 'cumshot', 'cumslut', 'cumdump'] },
    dick: {
        patterns: ['|dick|', '|dicks|', '|dck|', 'dickhead', 'dickface', 'dicksuck'],
        allowed: ['dickman']
    },
    dyke: { patterns: ['|dyke|', '|dykes|'] },
    fag: { patterns: ['|fag|', '|fags|', 'faggot', 'fagot', 'fggot'] },
    fuck: {
        patterns: ['fuck', 'phuck', '|f?ck|', '|f?cks|', 'f?cker', 'f?cking', '|fuk|', '|fuking'],
        allowed: ['fick']
    },
    kike: { patterns: ['|kike|', '|kikes|'] },
    nigger: {
        patterns: ['nigger', 'nigga', '|ngga', '|ngger', '|nig|', '|nigs|'],
        allowed: ['snigger', 'niggard']
    },
    semen: { patterns: ['|semen|'] },
    wank: { patterns: ['|wank|', 'wanker', 'wanking'] }
}

// Patterns are compared with repeated letters collapsed, so `zipperhead` is written `ziperhead`.
const ADDED_PHRASES: Record<string, Phrase> = {
    beaner: { patterns: ['|beaner|'] },
    coon: { patterns: ['|coon|', '|coons|'] },
    gook: { patterns: ['|gook|', '|gooks|'] },
    hitler: { patterns: ['hitler'], allowed: ['whitler', 'whittler'] },
    homo: { patterns: ['|homo|', '|homos|'] },
    jigaboo: { patterns: ['jigaboo'] },
    jews: {
        patterns: [
            'killjews',
            'killthejews',
            'hatejews',
            '|kill jews',
            '|kill the jews',
            '|hate jews'
        ]
    },
    nazi: { patterns: ['|nazi|', '|nazis|', 'nazism'] },
    paki: { patterns: ['|paki|', '|pakis|'] },
    pedo: { patterns: ['|pedo|', '|pedos|', 'pedophile', 'paedophile'] },
    porchmonkey: { patterns: ['porchmonkey', '|porch monkey'] },
    raghead: { patterns: ['raghead', '|rag head'] },
    sambo: { patterns: ['|sambo|'] },
    shemale: { patterns: ['|shemale|', '|she male|'] },
    siegheil: { patterns: ['siegheil', '|sieg heil'] },
    spic: { patterns: ['|spic|', '|spics|'] },
    towelhead: { patterns: ['towelhead', '|towel head'] },
    wetback: { patterns: ['wetback', '|wet back'] },
    whitepower: { patterns: ['whitepower', '|white power'] },
    zipperhead: { patterns: ['ziperhead', '|ziper head'] }
}

// These are whole-word above because they begin or end real names (`Coonrod`, `Raccoon`), so a
// name built on one is caught by listing the words people build them with.
const COMPOUNDED_TERMS = [
    'anal',
    'beaner',
    'coon',
    'cum',
    'dick',
    'dyke',
    'fag',
    'gook',
    'homo',
    'kike',
    'nazi',
    'paki',
    'pedo',
    'sambo',
    'spic'
]
const WORDS_AFTER_TERM = [
    'bear',
    'boi',
    'boy',
    'bro',
    'dude',
    'face',
    'fan',
    'gal',
    'girl',
    'guy',
    'hater',
    'head',
    'hunter',
    'killer',
    'king',
    'lord',
    'lover',
    'man',
    'master',
    'men',
    'queen',
    'slayer'
]
const WORDS_BEFORE_TERM = [
    'big',
    'black',
    'fat',
    'kill',
    'my',
    'old',
    'real',
    'super',
    'the',
    'white'
]

const LETTERS_KEPT_DOUBLED = new Set(['b', 'e', 'o', 'l', 's', 'g'])

function asCompared(word: string): string {
    return word.replace(/(.)\1+/g, (run, letter: string) =>
        LETTERS_KEPT_DOUBLED.has(letter) ? letter + letter : letter
    )
}

function compoundPatterns(term: string): string[] {
    return [
        ...WORDS_AFTER_TERM.map((word) => `|${asCompared(term + word)}`),
        ...WORDS_BEFORE_TERM.map((word) => `${asCompared(word + term)}|`)
    ]
}

const HATE_NUMBERS_AND_LETTERS = /kkk|(?<!\d)14\s*88(?!\d)/i

// The matcher reads `f*ck` but not these, whose masked letters are more than one wildcard allows.
const MASKED_SWEARING = /(?<![\p{L}\p{N}])(?:f[*#]{2,}k?|s(?:h[*#]+|[*#]{2})t)/iu

const INNOCENT_TERMS = [
    'bastard sword',
    'cock and bull',
    'cum laude',
    'homo sapiens',
    'mishit',
    'moby dick',
    'pissarro',
    'pussycat',
    'rio negro',
    'spic and span',
    'tit for tat'
]

const SEPARATORS = /[\s\p{P}\p{S}]/gu
const PUNCTUATION_INSIDE_A_WORD = /(?<=[\p{L}\p{N}])[\p{P}\p{S}]+(?=[\p{L}\p{N}])/gu
const DIGITS_ENDING_A_WORD = /(?<=\p{L})\d+(?![\p{L}\p{N}])/gu
const SPACED_OUT_CHARACTERS =
    /(?<![\p{L}\p{N}])[\p{L}\p{N}](?:[\s\p{P}\p{S}]+[\p{L}\p{N}](?![\p{L}\p{N}]))+/gu

const dataset = new DataSet<{ originalWord: string }>()
    .addAll(englishDataset)
    .removePhrasesIf(({ metadata }) =>
        LIBRARY_PHRASES_TO_DROP.includes(metadata?.originalWord ?? '')
    )
for (const [originalWord, { patterns, allowed = [] }] of Object.entries({
    ...NARROWED_PHRASES,
    ...ADDED_PHRASES
})) {
    dataset.addPhrase((phrase) => {
        phrase.setMetadata({ originalWord })
        for (const raw of patterns) phrase.addPattern(parseRawPattern(raw))
        for (const term of allowed) phrase.addWhitelistedTerm(term)
        return phrase
    })
}
for (const term of COMPOUNDED_TERMS) {
    dataset.addPhrase((phrase) => {
        phrase.setMetadata({ originalWord: `${term} compound` })
        for (const raw of compoundPatterns(term)) phrase.addPattern(parseRawPattern(raw))
        return phrase
    })
}
dataset.addPhrase((phrase) => {
    phrase.setMetadata({ originalWord: 'innocent terms' })
    for (const term of INNOCENT_TERMS) phrase.addWhitelistedTerm(term)
    return phrase
})

const matcher = new RegExpMatcher({ ...dataset.build(), ...englishRecommendedTransformers })

function withoutMarksAndInvisibles(text: string): string {
    return text.normalize('NFKD').replace(/[\p{M}\p{Cf}\p{Cc}]/gu, '')
}

function isOffensiveInAnyForm(forms: string[]): boolean {
    return forms.some((form) => matcher.hasMatch(form) || HATE_NUMBERS_AND_LETTERS.test(form))
}

export function isOffensiveUsername(username: string): boolean {
    const visible = withoutMarksAndInvisibles(username)
    const withoutSeparators = visible.replace(SEPARATORS, '')
    const withoutTrailingDigits = withoutSeparators.replace(/\d+$/, '')
    return isOffensiveInAnyForm([visible, withoutSeparators, withoutTrailingDigits])
}

// A game name is several words, so removing every separator would read `Is this it` as `shit`.
export function isOffensiveGameName(name: string): boolean {
    const visible = withoutMarksAndInvisibles(name)
    const tightened = visible
        .replace(PUNCTUATION_INSIDE_A_WORD, '')
        .replace(DIGITS_ENDING_A_WORD, '')
        .replace(SPACED_OUT_CHARACTERS, (characters) => characters.replace(SEPARATORS, ''))
    return MASKED_SWEARING.test(visible) || isOffensiveInAnyForm([visible, tightened])
}
