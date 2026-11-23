import type { ProvisionalEntry } from './provisional.js'

export const ProvisionalCards = {
    northernKingdomSpaces: {
        componentId: 'writ.charter.northern-kingdom',
        value: 'whether two dots mark badlands-2 and mountain-1',
        placeholder: ['space.badlands.2', 'space.mountain.1'],
        settledBy: 'the physical card beside the board',
        dataBlockedIn: ['writs.spec.ts', 'charters.spec.ts']
    },
    kingdomPastPrinted: {
        componentId: 'writ.charter.*-kingdom',
        value: 'what 5 or more locations ruled score, past the four printed values',
        placeholder: 9,
        settledBy: "the designer's ruling",
        ruling: 'R-6.2-H1',
        dataBlockedIn: ['charters.spec.ts']
    }
} as const satisfies Record<string, ProvisionalEntry>
