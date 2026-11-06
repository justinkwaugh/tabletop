import type { ProvisionalEntry } from './provisional.js'

/** Marks on the Royal Writs that no picture shows legibly. */
export const ProvisionalCards = {
    northernKingdomSpaces: {
        componentId: 'writ.charter.northern-kingdom',
        value: 'whether two dots mark badlands-2 and mountain-1',
        placeholder: ['space.badlands.2', 'space.mountain.1'],
        settledBy: 'the physical card beside the board',
        dataBlockedIn: ['writs.spec.ts', 'charters.spec.ts']
    }
} as const satisfies Record<string, ProvisionalEntry>
