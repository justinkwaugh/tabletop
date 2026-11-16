import type {
    AcquisitionChoice1822,
    LondonNodeId,
    MinorAcquisition1822,
    TokenChoice1822
} from '@tabletop/1822'
import { assertExists } from '@tabletop/common'
import { StagedSelection, singleChoice } from '@tabletop/18xx-ui'
import type { LocalSelection } from '@tabletop/frontend-components'

/** How the major company takes up the minor it has chosen to acquire (§5.18). */
export type MinorTerms = {
    shares: number
    token: TokenChoice1822
    discardTrainIds: string[]
    nodeId?: string
}
/** How the operating company takes up the private it has chosen to acquire (§5.7). */
export type PrivateTerms = {
    choice?: AcquisitionChoice1822
    discardTrainId?: string
}
export type PrivateOffer = {
    privateCompanyId: string
    choices: readonly AcquisitionChoice1822[]
    /** P1's 5-train takes the company over its train limit, so it names a train to discard. */
    needsDiscard: boolean
    /** The player holding the private where that is not the company's director, who must agree. */
    agreementPlayerId?: string
}

/**
 * 1822's choices made before an Action: a minor or a private to acquire, then how it is taken
 * up; P17's certificate to move; and the Metropolitan Railway's London station. Each pick's terms
 * start at their defaults and are the player's own once changed; Undo drops the whole choice
 * before it takes back any Action, and a new state clears them all.
 */
export class StagedChoices1822 {
    readonly minor = new StagedSelection<{ minor: string; terms: MinorTerms }>(['minor', 'terms'])
    readonly private = new StagedSelection<{ private: string; terms: PrivateTerms }>([
        'private',
        'terms'
    ])
    readonly stackCard: StagedSelection<{ choice: string }> = singleChoice<string>()
    readonly metropolitanStation: StagedSelection<{ choice: LondonNodeId }> =
        singleChoice<LondonNodeId>()
    /** Every choice, for the session's Undo and its clearing on a new state. */
    readonly selections: readonly LocalSelection[] = [
        this.minor,
        this.private,
        this.stackCard,
        this.metropolitanStation
    ]

    /** The minor company chosen and how it is taken, while that is being decided. */
    minorDraft(): ({ minorId: string } & MinorTerms) | undefined {
        const minorId = this.minor.value('minor')
        const terms = this.minor.value('terms')
        return minorId && terms ? { minorId, ...terms } : undefined
    }
    /** Chooses a minor to acquire, on the most shares it may be given and its first token choice. */
    chooseMinor(offer: MinorAcquisition1822): void {
        const [terms] = offer.terms.toSorted((a, b) => b.shares - a.shares)
        const [token] = offer.tokens
        const [nodeId] = offer.londonNodeIds ?? []
        assertExists(terms, 'An acquisition has terms')
        assertExists(token, 'An acquisition says what becomes of the exchange token')
        this.minor.choose('minor', offer.minorId)
        this.minor.choose(
            'terms',
            { shares: terms.shares, token, discardTrainIds: [], ...(nodeId ? { nodeId } : {}) },
            'auto'
        )
    }
    changeMinorTerms(change: Partial<MinorTerms>): void {
        const terms = this.minor.value('terms')
        assertExists(terms, 'Choose the minor company to acquire')
        this.minor.choose('terms', { ...terms, ...change })
    }
    /** Marks a train to discard or keeps it after all, never more than the acquisition must discard. */
    toggleMinorDiscard(trainId: string, excessTrains: number): void {
        const draft = this.minorDraft()
        assertExists(draft, 'Choose the minor company to acquire')
        const kept = draft.discardTrainIds.filter((entry) => entry !== trainId)
        this.changeMinorTerms({
            discardTrainIds:
                kept.length < draft.discardTrainIds.length
                    ? kept
                    : [...draft.discardTrainIds, trainId].slice(-excessTrains)
        })
    }

    /** The private company chosen and how it is taken up, while that is being decided. */
    privateDraft(): ({ privateCompanyId: string } & PrivateTerms) | undefined {
        const privateCompanyId = this.private.value('private')
        const terms = this.private.value('terms')
        return privateCompanyId && terms ? { privateCompanyId, ...terms } : undefined
    }
    /**
     * Chooses a private to acquire, on its first choice and the first train to discard where it
     * needs one; false where there is nothing to choose, and the acquisition goes ahead at once.
     */
    choosePrivate(offer: PrivateOffer, firstTrainId: string | undefined): boolean {
        if (!offer.choices.length && !offer.needsDiscard) return false
        const [choice] = offer.choices
        this.private.choose('private', offer.privateCompanyId)
        this.private.choose(
            'terms',
            {
                ...(choice ? { choice } : {}),
                ...(offer.needsDiscard && firstTrainId ? { discardTrainId: firstTrainId } : {})
            },
            'auto'
        )
        return true
    }
    changePrivateTerms(change: PrivateTerms): void {
        const terms = this.private.value('terms')
        assertExists(terms, 'Choose the private company to acquire')
        this.private.choose('terms', { ...terms, ...change })
    }
}
