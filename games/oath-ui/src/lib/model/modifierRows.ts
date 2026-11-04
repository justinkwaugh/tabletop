import {
    ActionType,
    HydratedUseActionPower,
    cardPowers,
    offeredChoices,
    usableModifiers,
    type CardPower,
    type HydratedOathGameState,
    type LegalChoice,
    type ModifierUse,
    type PowerChoice,
    type PowerUseKey
} from '@tabletop/oath'
import {
    emptyPicks,
    picksComplete,
    powerChoicesFrom,
    type PowerChoicePicks
} from './powerChoices.js'
import { powerUseKey, samePowerUse } from './powerUse.js'
import { soleDeclarations } from './actionCards.js'
import { visionPlayCards } from './adviserPlacements.js'

/**
 * R-7.4 — what the "Cards" rows (`ModifierPicker`) read and set: the cards listed, which are in use,
 * and the picks each one's text opens.
 */
export interface ModifierRows {
    readonly listed: CardPower[]
    isDeclared(use: PowerUseKey): boolean
    declare(use: PowerUseKey, on: boolean): void
    /** Master of Disguise — the player a listed card is lent by. */
    lenderOf(power: CardPower): string | undefined
    /** A card whose pick another row makes, so it draws no picker of its own. */
    picksInMenu(power: CardPower): boolean
    choicesOf(power: CardPower): LegalChoice[]
    picksOf(use: PowerUseKey): PowerChoicePicks
    setPicks(use: PowerUseKey, picks: PowerChoicePicks): void
}

/** A card put in use on a power's row, with its picks. */
export type DeclaredModifier = { use: PowerUseKey; picks: PowerChoicePicks }

/** The power whose use declares the cards: its key, and the choices it is sent with. */
export type DeclaringPower = PowerUseKey & { choices: readonly PowerChoice[] }

/** Whether the play or discard is accepted with these cards in use. */
export type ModifierJudge = (uses: readonly ModifierUse[]) => boolean

/**
 * R-6.1, R-7.4 — a Vision played or discarded "as if you searched": Oracle's draw, whose use declares the Search
 * modifiers that act on that play before the draw, and False Prophet's Vision, whose answer declares them with the
 * play. Both in the Search's own "Cards" rows. Listed: each Search modifier in reach that can act on a Vision's play
 * or discard and that the judge accepts beside the cards in use, so one refused beside them is hidden (R-7.4-H2:
 * Bracken once the Cracked Horn is in use, and the other way round). A card that never acts on a Vision is hidden too
 * (Great Spire, Wild Cry), though the judge accepts it. Nothing starts in use.
 */
export class AsIfSearchedRows implements ModifierRows {
    private acting?: CardPower[]

    constructor(
        private readonly state: HydratedOathGameState,
        private readonly playerId: string,
        private readonly accepts: ModifierJudge,
        private readonly declared: readonly DeclaredModifier[],
        private readonly change: (declared: DeclaredModifier[]) => void
    ) {}

    /** Whether the power's use takes Search modifiers at all (from revision 31). */
    static offered(state: HydratedOathGameState, power: PowerUseKey): boolean {
        return HydratedUseActionPower.takesSearchModifiers(state, power.cardId, power.powerIndex)
    }

    /** Oracle's rows: judged by the power's use, with its choices. */
    static forPower(
        state: HydratedOathGameState,
        playerId: string,
        power: DeclaringPower,
        declared: readonly DeclaredModifier[],
        change: (declared: DeclaredModifier[]) => void
    ): AsIfSearchedRows {
        const accepts: ModifierJudge = (uses) =>
            HydratedUseActionPower.reasonCannotUse(
                state,
                playerId,
                power.cardId,
                power.powerIndex,
                power.choices,
                uses
            ) === undefined
        return new AsIfSearchedRows(state, playerId, accepts, declared, change)
    }

    get listed(): CardPower[] {
        const acting = this.actingOnTheVision()
        return usableModifiers(this.state, this.playerId, ActionType.Search, []).filter(
            (card) =>
                acting.some((power) => samePowerUse(power, card)) &&
                (this.isDeclared(card) ||
                    soleDeclarations(this.state, this.playerId, card).some((way) =>
                        this.besideInUse().every((others) => this.accepts([...others, way]))
                    ))
        )
    }

    /** The Search cards that can act on the Vision's play or discard, worked out once for the row. */
    private actingOnTheVision(): CardPower[] {
        this.acting ??= visionPlayCards(this.state, this.playerId)
        return this.acting
    }

    /**
     * The cards in use as they will be sent: each with its picks made, and one still waiting for a pick
     * at every pick it can take, so a card is listed only if it is accepted whatever is picked.
     */
    private besideInUse(): ModifierUse[][] {
        return this.declared.reduce<ModifierUse[][]>(
            (sets, entry) => {
                const card = cardPowers(entry.use.cardId)[entry.use.powerIndex]
                if (!card) return sets
                const ways = this.picksMade(entry)
                    ? [this.useOf(entry)]
                    : soleDeclarations(this.state, this.playerId, card)
                return sets.flatMap((set) => ways.map((way) => [...set, way]))
            },
            [[]]
        )
    }

    private useOf(entry: DeclaredModifier): ModifierUse {
        const card = cardPowers(entry.use.cardId)[entry.use.powerIndex]
        const legal = card ? offeredChoices(this.state, this.playerId, card) : []
        const use = powerUseKey(entry.use)
        return legal.length === 0 ? use : { ...use, choices: powerChoicesFrom(legal, entry.picks) }
    }

    private picksMade(entry: DeclaredModifier): boolean {
        const card = cardPowers(entry.use.cardId)[entry.use.powerIndex]
        return !card || picksComplete(this.choicesOf(card), entry.picks)
    }

    /** The cards in use, as the use sends them. */
    get uses(): ModifierUse[] {
        return this.declared.map((entry) => this.useOf(entry))
    }

    /** "Use" waits for each card in use to have its picks (Bracken's pile and side). */
    get complete(): boolean {
        return this.declared.every((entry) => this.picksMade(entry))
    }

    isDeclared(use: PowerUseKey): boolean {
        return this.declared.some((entry) => samePowerUse(entry.use, use))
    }

    declare(use: PowerUseKey, on: boolean): void {
        if (on === this.isDeclared(use)) return
        if (on && !this.listed.some((card) => samePowerUse(card, use))) return
        this.change(
            on
                ? [...this.declared, { use: powerUseKey(use), picks: emptyPicks() }]
                : this.declared.filter((entry) => !samePowerUse(entry.use, use))
        )
    }

    lenderOf(): string | undefined {
        return undefined
    }

    picksInMenu(): boolean {
        return false
    }

    choicesOf(power: CardPower): LegalChoice[] {
        return offeredChoices(this.state, this.playerId, power)
    }

    picksOf(use: PowerUseKey): PowerChoicePicks {
        return this.declared.find((entry) => samePowerUse(entry.use, use))?.picks ?? emptyPicks()
    }

    setPicks(use: PowerUseKey, picks: PowerChoicePicks): void {
        if (!this.isDeclared(use)) return
        this.change(
            this.declared.map((entry) =>
                samePowerUse(entry.use, use) ? { ...entry, picks } : entry
            )
        )
    }
}
