import {
    ActionType,
    HydratedSearch,
    PowerChoiceKind,
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
    powerChoicesFrom,
    withOptionPick,
    type PowerChoicePicks
} from './powerChoices.js'
import { assert } from '@tabletop/common'
import type { ModifierDeclaration } from './oathSelection.svelte.js'
import { powerUseKey, samePowerUse } from './powerUse.js'
import type { OathGameSession } from './session.svelte.js'

export type RegionVariant = {
    region: Region
    modifiers: ModifierUse[]
    use: PowerUseKey
    picks: PowerChoicePicks
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

    choicesOf(power: CardPower): LegalChoice[] {
        const playerId = this.session.liveSeatId
        return playerId ? legalChoices(this.session.gameState, playerId, power) : []
    }

    get declared(): ModifierUse[] {
        const playerId = this.session.liveSeatId
        const action = this.session.selection.action
        if (!playerId || !action) return []
        const usable = usableModifiers(this.session.gameState, playerId, action)
        return this.session.selection.modifiers.flatMap(({ use, picks }) => {
            const power = usable.find((p) => samePowerUse(p, use))
            if (!power) return []
            const legal = legalChoices(this.session.gameState, playerId, power)
            if (legal.length === 0) return [use]
            return [{ ...use, choices: powerChoicesFrom(legal, picks ?? emptyPicks()) }]
        })
    }

    /** R-7.4 — the powers list opens an action with one card in use. */
    open(use: PowerUseKey): void {
        assert(
            this.options.some((p) => samePowerUse(p, use)),
            `${use.cardId} is not a modifier the staged action can use`
        )
        this.session.selection.set('modifiers', [{ use, opened: true }])
    }

    isDeclared(use: PowerUseKey): boolean {
        return this.declared.some((m) => samePowerUse(m, use))
    }

    /** R-5.1.1 — one Search draws from one pile, so declaring a modifier that names it puts down another that does. */
    declare(use: PowerUseKey, on: boolean): void {
        const options = this.options
        const power = options.find((p) => samePowerUse(p, use))
        if (!power) return
        const staged = this.session.selection.modifiers
        const rest = staged.filter((m) => !samePowerUse(m.use, use))
        if (!on) {
            // An action only a card makes possible keeps one such card in use; Undo leaves the menu.
            if (this.aloneMakesPossible(use, rest)) return
            this.session.selection.set('modifiers', this.keepingRoute(staged, rest))
            return
        }
        const namesPile = (p: CardPower) => this.drawPileChoice(p) !== undefined
        const kept = namesPile(power)
            ? rest.filter((m) => !options.some((p) => samePowerUse(p, m.use) && namesPile(p)))
            : rest
        this.session.selection.set('modifiers', this.keepingRoute(staged, [...kept, { use }]))
    }

    private aloneMakesPossible(use: PowerUseKey, rest: readonly ModifierDeclaration[]): boolean {
        const action = this.session.selection.action
        const makers = this.session.actionCards.filter(
            (card) => card.action === action && card.kind === 'makesPossible'
        )
        if (!makers.some((card) => samePowerUse(card, use))) return false
        return !rest.some((m) => makers.some((card) => samePowerUse(card, m.use)))
    }

    /** An action entered from the powers list stays so while a card is in use, whichever card. */
    private keepingRoute(
        staged: readonly ModifierDeclaration[],
        next: ModifierDeclaration[]
    ): ModifierDeclaration[] {
        const [first, ...others] = next
        if (!first || next.some((m) => m.opened) || !staged.some((m) => m.opened)) return next
        return [{ ...first, opened: true }, ...others]
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
        this.session.selection.set(
            'modifiers',
            modifiers.map((m) => (samePowerUse(m.use, use) ? { ...m, picks } : m))
        )
    }
}
