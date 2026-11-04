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
    jews: { patterns: ['killjews', 'killthejews', 'hatejews'] },
    nazi: { patterns: ['|nazi|', '|nazis|', 'nazism'] },
    paki: { patterns: ['|paki|', '|pakis|'] },
    pedo: { patterns: ['|pedo|', '|pedos|', 'pedophile', 'paedophile'] },
    porchmonkey: { patterns: ['porchmonkey'] },
    raghead: { patterns: ['raghead'] },
    sambo: { patterns: ['|sambo|'] },
    shemale: { patterns: ['|shemale|'] },
    siegheil: { patterns: ['siegheil'] },
    spic: { patterns: ['|spic|', '|spics|'] },
    towelhead: { patterns: ['towelhead'] },
    wetback: { patterns: ['wetback'] },
    whitepower: { patterns: ['whitepower'] },
    zipperhead: { patterns: ['ziperhead'] }
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

const HATE_NUMBERS_AND_LETTERS = /kkk|(?<!\d)1488(?!\d)/i

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
dataset.addPhrase((phrase) =>
    phrase
        .setMetadata({ originalWord: 'shit and pussy allowances' })
        .addWhitelistedTerm('mishit')
        .addWhitelistedTerm('pussycat')
)

const matcher = new RegExpMatcher({ ...dataset.build(), ...englishRecommendedTransformers })

function withoutMarksAndInvisibles(username: string): string {
    return username.normalize('NFKD').replace(/[\p{M}\p{Cf}\p{Cc}]/gu, '')
}

export function isOffensiveUsername(username: string): boolean {
    const visible = withoutMarksAndInvisibles(username)
    const withoutSeparators = visible.replace(/[\s\p{P}\p{S}]/gu, '')
    const withoutTrailingDigits = withoutSeparators.replace(/\d+$/, '')
    return [visible, withoutSeparators, withoutTrailingDigits].some(
        (form) => matcher.hasMatch(form) || HATE_NUMBERS_AND_LETTERS.test(form)
    )
}
