import { assertExists } from '@tabletop/common'
import {
    ActionType,
    CHRONICLE_STORY_LIMIT,
    FAVOR_BANK_ORDER,
    OathType,
    chronicleSuitLeaders,
    citizenshipEligible,
    edificeChoices,
    normalizedStory,
    vowableOaths,
    type EdificeChoice,
    type Suit
} from '@tabletop/oath'
import { OneStepDraft } from './phaseDrafts.js'

// R-8 — the chronicle's choices. Each offer is the engine's own reader on the served view, the
// chooser's projected state, never a copy of the rules here.

/** R-2.11 — the four Oaths in the Law's order. */
export const OATH_ORDER: readonly OathType[] = [
    OathType.Supremacy,
    OathType.ThePeople,
    OathType.Protection,
    OathType.Devotion
]

/** R-8.1 — the winner picks the next Oath from the goal cards' top halves; Confirm sends it. */
export class OathPickDraft extends OneStepDraft<OathType> {
    /** Every Oath but this game's, in the Law's order; none unless this seat vows now. */
    get oaths(): readonly OathType[] {
        if (!this.session.liveTurnSeatId) return []
        if (!this.session.validActionTypes.includes(ActionType.ChooseOath)) return []
        const vowable = vowableOaths(this.session.gameState)
        return OATH_ORDER.filter((oath) => vowable.includes(oath))
    }

    get picked(): OathType | undefined {
        const stored = this.stored
        return stored !== undefined && this.oaths.includes(stored) ? stored : undefined
    }

    pick(oathType: OathType): void {
        this.store(oathType)
    }

    async confirm(): Promise<void> {
        const picked = this.picked
        assertExists(picked, 'Confirm shows only once an Oath is picked')
        await this.session.chooseOath(picked)
    }
}

/** R-8.2 — the winner's offer: each chip toggles; "Offer" once one is picked, "No offer" always. */
export class ChronicleOfferDraft extends OneStepDraft<readonly string[]> {
    get eligible(): readonly string[] {
        if (!this.session.liveTurnSeatId) return []
        if (!this.session.validActionTypes.includes(ActionType.OfferChronicleCitizenship)) return []
        return citizenshipEligible(this.session.gameState)
    }

    get picked(): readonly string[] {
        const eligible = this.eligible
        return (this.stored ?? []).filter((playerId) => eligible.includes(playerId))
    }

    toggle(playerId: string): void {
        const picked = this.picked
        this.store(
            picked.includes(playerId)
                ? picked.filter((id) => id !== playerId)
                : // In the seats' order, as the engine lists them.
                  this.eligible.filter((id) => id === playerId || picked.includes(id))
        )
    }

    async offer(): Promise<void> {
        await this.session.offerChronicleCitizenship([...this.picked])
    }

    async noOffer(): Promise<void> {
        await this.session.offerChronicleCitizenship([])
    }
}

/**
 * R-8.3.1 — the winner's legal builds and repairs, ringed on the map; a tap points one, and the
 * panel shows the edifice that would stand there.
 */
export class BuildPickDraft extends OneStepDraft<string> {
    get choices(): readonly EdificeChoice[] {
        if (!this.session.liveTurnSeatId) return []
        if (!this.session.validActionTypes.includes(ActionType.BuildOrRepairEdifice)) return []
        return edificeChoices(this.session.gameState)
    }

    /** The cards ringed on the map: the denizen a build replaces, the ruin a repair flips. */
    get ringed(): string[] {
        return this.choices.map((choice) => choice.cardId)
    }

    get pointed(): EdificeChoice | undefined {
        const cardId = this.stored
        return this.choices.find((choice) => choice.cardId === cardId)
    }

    /** "Build or repair an edifice." once a ruin is ringed. */
    get repairOffered(): boolean {
        return this.choices.some((choice) => choice.repair)
    }

    point(cardId: string): void {
        this.store(cardId)
    }

    async confirm(): Promise<void> {
        const pointed = this.pointed
        assertExists(pointed, 'Build or Repair shows only once a card is pointed')
        await this.session.buildOrRepairEdifice({ siteId: pointed.siteId, cardId: pointed.cardId })
    }

    async none(): Promise<void> {
        await this.session.buildOrRepairEdifice(undefined)
    }
}

/** R-8.4 — a suit's button adds 3 of it, then 2 and 1 of the next suits clockwise. */
export function addedBySuit(suit: Suit): { suit: Suit; count: number }[] {
    const at = FAVOR_BANK_ORDER.indexOf(suit)
    return [3, 2, 1].map((count, k) => ({
        suit: FAVOR_BANK_ORDER[(at + k) % FAVOR_BANK_ORDER.length],
        count
    }))
}

/** R-8.4 — the tied suits, or all six with no faceup adviser; Confirm sends the one picked. */
export class ChronicleSuitDraft extends OneStepDraft<Suit> {
    get suits(): readonly Suit[] {
        if (!this.session.liveTurnSeatId) return []
        if (!this.session.validActionTypes.includes(ActionType.ChooseChronicleSuit)) return []
        return chronicleSuitLeaders(this.session.gameState)
    }

    get picked(): Suit | undefined {
        const stored = this.stored
        return stored !== undefined && this.suits.includes(stored) ? stored : undefined
    }

    pick(suit: Suit): void {
        this.store(suit)
    }

    async confirm(): Promise<void> {
        const picked = this.picked
        assertExists(picked, 'Confirm shows only once a suit is picked')
        await this.session.chooseChronicleSuit(picked)
    }
}

/** R-8.4.a-H1 — the tied Dispossessed stacks, each taking `count`; Confirm sends the one picked. */
export class HealStackDraft extends OneStepDraft<Suit> {
    get suits(): readonly Suit[] {
        if (!this.session.liveTurnSeatId) return []
        if (!this.session.validActionTypes.includes(ActionType.ChooseHealStack)) return []
        return this.session.gameState.chronicle?.healTie?.suits ?? []
    }

    /** R-8.4.a — the stack holds fewer than six when it is short. */
    get count(): number {
        return Math.min(6, this.session.gameState.chronicle?.healTie?.count ?? 0)
    }

    get picked(): Suit | undefined {
        const stored = this.stored
        return stored !== undefined && this.suits.includes(stored) ? stored : undefined
    }

    pick(suit: Suit): void {
        this.store(suit)
    }

    async confirm(): Promise<void> {
        const picked = this.picked
        assertExists(picked, 'Confirm shows only once a stack is picked')
        await this.session.chooseHealStack(picked)
    }
}

/** The story's count shows only in its last hundred characters. */
const COUNT_SHOWN_FROM = 100

/**
 * The story as the engine will keep it, counted in Unicode code points (`normalizedStory`'s
 * rules): `maxlength` counts UTF-16 units, so the box caps its own text here.
 */
export function storyDraft(text: string): { text: string; left: number; countShown: boolean } {
    const points = [...text]
    const capped =
        points.length > CHRONICLE_STORY_LIMIT ? points.slice(0, CHRONICLE_STORY_LIMIT) : points
    const left = CHRONICLE_STORY_LIMIT - [...normalizedStory(capped.join(''))].length
    return { text: capped.join(''), left, countShown: left <= COUNT_SHOWN_FROM }
}

/** "Write" appears once the story holds more than white space. */
export function storyWritable(text: string): boolean {
    return normalizedStory(text).length > 0
}

/**
 * R-8.5 — the winner's story as it is typed, kept on the session as every panel's value is: the
 * panel is drawn again on stepping into History or toggling full screen, and the text stays. Write
 * sends it; Skip, any send and Undo clear it.
 */
export class ChronicleStoryDraft extends OneStepDraft<string> {
    get text(): string {
        return this.stored ?? ''
    }

    get left(): number {
        return storyDraft(this.text).left
    }

    get countShown(): boolean {
        return storyDraft(this.text).countShown
    }

    get writable(): boolean {
        return storyWritable(this.text)
    }

    /** Keeps the typed text, capped; an emptied box holds no draft. Returns what is kept. */
    edit(value: string): string {
        const capped = storyDraft(value).text
        if (capped === '') this.reset()
        else this.store(capped)
        return capped
    }

    async write(): Promise<void> {
        await this.session.writeChronicleStory(this.text)
    }

    async skip(): Promise<void> {
        await this.session.skipChronicleStory()
    }
}
