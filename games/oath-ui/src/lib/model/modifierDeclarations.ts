import {
    ActionType,
    HydratedSearch,
    PowerChoiceKind,
    isFreeGain,
    legalChoices,
    usableModifiers,
    type CardPower,
    type LegalChoice,
    type ModifierUse,
    type PowerUseKey,
    type Region
} from '@tabletop/oath'
import {
    emptyPicks,
    picksComplete,
    powerChoicesFrom,
    withOptionPick,
    type PowerChoicePicks
} from './powerChoices.js'
import { assert } from '@tabletop/common'
import type { ModifierDeclaration } from './oathSelection.svelte.js'
import { powerUseKey, samePowerUse } from './powerUse.js'
import type { OathGameSession } from './session.svelte.js'
import {
    CARD_ACTIONS,
    actionCardUses,
    actionMenu,
    fitsARow,
    soleDeclarations,
    type ActionCard,
    type CardAction
} from './actionCards.js'

export type RegionVariant = {
    region: Region
    modifiers: ModifierUse[]
    use: PowerUseKey
    picks: PowerChoicePicks
}

function cardAction(action: ActionType | undefined): CardAction | undefined {
    return CARD_ACTIONS.find((a) => a === action)
}

/** The entry without the powers list's mark, its other fields kept. */
function unopened(m: ModifierDeclaration): ModifierDeclaration {
    return {
        use: m.use,
        ...(m.picks ? { picks: m.picks } : {}),
        ...(m.seeded ? { seeded: true as const } : {}),
        ...(m.down ? { down: true as const } : {})
    }
}

/** R-7.4 — the modifiers usable with the staged action, and the choices each one's text opens. */
export class ModifierDeclarations {
    constructor(private readonly session: OathGameSession) {}

    get options(): CardPower[] {
        const playerId = this.session.liveSeatId
        const action = this.session.selection.action
        if (!playerId || !action) return []
        return usableModifiers(this.session.gameState, playerId, action)
    }

    /**
     * R-7.4 — the cards the menu offers as rows: each usable card that, put in use beside the
     * cards already in use, applies to some row of the menu. A card that fits no row is not listed.
     */
    get listed(): CardPower[] {
        const playerId = this.session.liveSeatId
        const action = cardAction(this.session.selection.action)
        if (!playerId || !action) return []
        const state = this.session.gameState
        const declared = this.declared
        const live = this.session.selection.modifiers.filter((m) => !m.down)
        return this.options.filter((power) => {
            const use = powerUseKey(power)
            // A card in use whose picks are still open stays listed, its picker under it.
            const entry = live.find((m) => samePowerUse(m.use, use))
            if (entry && !picksComplete(this.choicesOf(power), entry.picks ?? emptyPicks())) {
                return true
            }
            const others = declared.filter((m) => !samePowerUse(m, use))
            const own = declared.filter((m) => samePowerUse(m, use))
            const ways = own.length > 0 ? own : soleDeclarations(state, playerId, power)
            return ways.some((way) =>
                fitsARow(actionMenu(state, playerId, action, [...others, way]), use)
            )
        })
    }

    choicesOf(power: CardPower): LegalChoice[] {
        const playerId = this.session.liveSeatId
        return playerId ? legalChoices(this.session.gameState, playerId, power) : []
    }

    get declared(): ModifierUse[] {
        const playerId = this.session.liveSeatId
        const action = this.session.selection.action
        if (!playerId || !action) return []
        const usable = usableModifiers(this.session.gameState, playerId, action)
        return this.session.selection.modifiers.flatMap(({ use, picks, down }) => {
            if (down) return []
            const power = usable.find((p) => samePowerUse(p, use))
            if (!power) return []
            const legal = legalChoices(this.session.gameState, playerId, power)
            if (legal.length === 0) return [use]
            return [{ ...use, choices: powerChoicesFrom(legal, picks ?? emptyPicks()) }]
        })
    }

    /**
     * R-7.4 — a card in use whose picks are not all made (Hospitality's bank, Bracken's pile): the
     * menu's rows wait for them, so no row is sent without a card the player is still setting. A
     * pile a Search would draw from is picked by its row instead (`regionVariants`).
     */
    get picksPending(): boolean {
        const live = this.session.selection.modifiers.filter((m) => !m.down)
        return this.options.some((power) => {
            const entry = live.find((m) => samePowerUse(m.use, power))
            if (!entry || this.drawPileChoice(power)) return false
            return !picksComplete(this.choicesOf(power), entry.picks ?? emptyPicks())
        })
    }

    /** R-7.4 — an action starts with its free gains in use (Dragonskin Drum, Rowdy Pub, Wild Cry …). */
    seed(): void {
        const seeds = this.options.filter(isFreeGain)
        if (seeds.length === 0) return
        this.session.selection.setModifiers(
            seeds.map((power): ModifierDeclaration => ({ use: powerUseKey(power), seeded: true }))
        )
    }

    /**
     * R-7.4 — the powers list opens an action with its card, or a pair's two cards, in use. Both
     * of a pair are marked opened, so Undo takes them back to the powers together.
     */
    open(uses: readonly PowerUseKey[]): void {
        assert(uses.length > 0, 'An action is opened with a card in use')
        for (const use of uses) {
            assert(
                this.options.some((p) => samePowerUse(p, use)),
                `${use.cardId} is not a modifier the staged action can use`
            )
        }
        const seeds = this.session.selection.modifiers.filter(
            (m) => !uses.some((use) => samePowerUse(m.use, use))
        )
        this.session.selection.setModifiers([
            ...seeds,
            ...uses.map((use) => ({ use, opened: true as const }))
        ])
    }

    isDeclared(use: PowerUseKey): boolean {
        return this.declared.some((m) => samePowerUse(m, use))
    }

    /**
     * A tap puts a card in use or down: a free gain the action started with is kept, marked down,
     * so Undo can bring it back. R-5.1.1 — one Search draws from one pile, so declaring a modifier
     * that names it puts down another that does.
     */
    declare(use: PowerUseKey, on: boolean): void {
        const options = this.options
        const power = options.find((p) => samePowerUse(p, use))
        if (!power) return
        const staged = this.session.selection.modifiers
        const entry = staged.find((m) => samePowerUse(m.use, use))
        if (!on) {
            if (!entry || entry.down) return
            // An action only these cards make possible keeps them in use; Undo leaves the menu.
            if (this.onlyPossibleWith(use)) return
            const next = entry.seeded
                ? staged.map((m) =>
                      m === entry ? { use: m.use, seeded: true as const, down: true as const } : m
                  )
                : staged.filter((m) => m !== entry)
            this.session.selection.setModifiers(this.keepingRoute(staged, next))
            return
        }
        if (entry && !entry.down) return
        const namesPile = (p: CardPower) => this.drawPileChoice(p) !== undefined
        const kept = namesPile(power)
            ? staged.filter((m) => !options.some((p) => samePowerUse(p, m.use) && namesPile(p)))
            : staged
        const next = entry
            ? kept.map((m) => (m === entry ? { use: m.use, seeded: true as const } : m))
            : [...kept, { use }]
        this.session.selection.setModifiers(this.keepingRoute(staged, next))
    }

    /**
     * R-7.4 — of the powers list's entries that make the action possible (a card, or a pair), one
     * stays in use whatever is tapped: the card is one of an entry in use, and no such entry
     * would be in use without it. A pair keeps both its cards.
     */
    private onlyPossibleWith(use: PowerUseKey): boolean {
        const action = this.session.selection.action
        const makers = this.session.actionCards.filter(
            (card) => card.action === action && card.kind === 'makesPossible'
        )
        const inUse = (card: ActionCard, without?: PowerUseKey) =>
            actionCardUses(card).every(
                (u) => (!without || !samePowerUse(u, without)) && this.isDeclared(u)
            )
        const ofIt = (card: ActionCard) => actionCardUses(card).some((u) => samePowerUse(u, use))
        return (
            makers.some((card) => ofIt(card) && inUse(card)) &&
            !makers.some((card) => inUse(card, use))
        )
    }

    /** An action entered from the powers list stays so while a card is in use, whichever card. */
    private keepingRoute(
        staged: readonly ModifierDeclaration[],
        next: ModifierDeclaration[]
    ): ModifierDeclaration[] {
        const live = (m: ModifierDeclaration) => !m.down
        if (next.some((m) => m.opened && live(m)) || !staged.some((m) => m.opened)) return next
        const unmarked = next.map(unopened)
        const heir = unmarked.find((m) => live(m) && !m.seeded) ?? unmarked.find(live)
        return unmarked.map((m) => (m === heir ? { ...m, opened: true as const } : m))
    }

    picksOf(use: PowerUseKey): PowerChoicePicks {
        return (
            this.session.selection.modifiers.find((m) => samePowerUse(m.use, use))?.picks ??
            emptyPicks()
        )
    }

    /**
     * R-7.4 — the region choice of a modifier that names the pile a Search draws from, as Errand Boy
     * and Observatory do: the engine draws from the region picked. Bracken's region is where the
     * discards go, so it is not one.
     */
    private drawPileChoice(power: CardPower): { legal: LegalChoice[]; index: number } | undefined {
        const playerId = this.session.liveSeatId
        if (!playerId || this.session.selection.action !== ActionType.Search) return undefined
        const state = this.session.gameState
        const legal = legalChoices(state, playerId, power)
        const index = legal.findIndex((choice) =>
            choice.options.some((option) => option.kind === PowerChoiceKind.Region)
        )
        const choice = legal[index]
        if (!choice) return undefined
        const home = HydratedSearch.drawRegion(state, playerId, [])
        const use = powerUseKey(power)
        const drawsFromThePick = choice.options.some((option, pick) => {
            if (option.kind !== PowerChoiceKind.Region || option.region === home) return false
            const picks = withOptionPick(emptyPicks(), choice, index, pick)
            const named = { ...use, choices: powerChoicesFrom(legal, picks) }
            return HydratedSearch.drawRegion(state, playerId, [named]) === option.region
        })
        return drawsFromThePick ? { legal, index } : undefined
    }

    /** R-7.4 — each pile the declared modifier lets the Search draw from. */
    get regionVariants(): RegionVariant[] {
        const playerId = this.session.liveSeatId
        const action = this.session.selection.action
        if (!playerId || !action) return []
        const state = this.session.gameState
        const usable = usableModifiers(state, playerId, action)
        const declared = this.declared
        for (const entry of this.session.selection.modifiers) {
            if (entry.down) continue
            const power = usable.find((p) => samePowerUse(p, entry.use))
            if (!power) continue
            const pile = this.drawPileChoice(power)
            if (!pile) continue
            const { legal, index } = pile
            const choice = legal[index]
            if (!choice) continue
            return choice.options.flatMap((option, pick) => {
                if (option.kind !== PowerChoiceKind.Region) return []
                const picks = withOptionPick(entry.picks ?? emptyPicks(), choice, index, pick)
                const named = { ...entry.use, choices: powerChoicesFrom(legal, picks) }
                const modifiers = declared.map((m) => (samePowerUse(m, entry.use) ? named : m))
                return [{ region: option.region, modifiers, use: entry.use, picks }]
            })
        }
        return []
    }

    setPicks(use: PowerUseKey, picks: PowerChoicePicks): void {
        const modifiers = this.session.selection.modifiers
        if (!modifiers.some((m) => samePowerUse(m.use, use))) return
        this.session.selection.setModifiers(
            modifiers.map((m) => (samePowerUse(m.use, use) ? { ...m, picks } : m))
        )
    }
}
