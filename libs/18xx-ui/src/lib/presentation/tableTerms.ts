import { capitalized, lowerFirst } from './words.js'

/** What a title's rulebook calls the things the table names, where it differs from the family. */
export type TableTerms = {
    president: string
    presidency: string
    presidentMark: string
    stockMarket: string
    marketPool: string
    stationTokensHeading: string
    stationToken: string
    depot: string
}

export type ResolvedTableTerms = TableTerms & {
    presidentWord: string
    presidencyWord: string
    presidentCertificate: string
    /** Puts the title's words into a sentence written with the family's, such as a rules reason. */
    reword(text: string): string
}

const FamilyTerms: TableTerms = {
    president: 'President',
    presidency: 'Presidency',
    presidentMark: 'P',
    stockMarket: 'Market',
    marketPool: 'Market',
    stationTokensHeading: 'Tokens',
    stationToken: 'station token',
    depot: 'Depot'
}

export function tableTerms(overrides: Partial<TableTerms> = {}): ResolvedTableTerms {
    const terms = { ...FamilyTerms, ...overrides }
    const presidentWord = lowerFirst(terms.president)
    const presidencyWord = lowerFirst(terms.presidency)
    return {
        ...terms,
        presidentWord,
        presidencyWord,
        presidentCertificate: `${terms.president}’s certificate`,
        reword: (text) =>
            text.replace(/\b([Pp])residen(t|cy)\b/g, (_match, initial: string, ending: string) => {
                const word = ending === 't' ? presidentWord : presidencyWord
                return initial === 'P' ? capitalized(word) : word
            })
    }
}

export const DefaultTableTerms = tableTerms()
