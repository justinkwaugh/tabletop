import {
    legalChoices,
    usableModifiers,
    type CardPower,
    type LegalChoice,
    type ModifierUse,
    type PowerUseKey
} from '@tabletop/oath'
import { emptyPicks, powerChoicesFrom, type PowerChoicePicks } from './powerChoices.js'
import { samePowerUse } from './powerUse.js'
import type { OathGameSession } from './session.svelte.js'

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

    isDeclared(use: PowerUseKey): boolean {
        return this.declared.some((m) => samePowerUse(m, use))
    }

    declare(use: PowerUseKey, on: boolean): void {
        if (!this.options.some((p) => samePowerUse(p, use))) return
        const rest = this.session.selection.modifiers.filter((m) => !samePowerUse(m.use, use))
        this.session.selection.set('modifiers', on ? [...rest, { use }] : rest)
    }

    picksOf(use: PowerUseKey): PowerChoicePicks {
        return (
            this.session.selection.modifiers.find((m) => samePowerUse(m.use, use))?.picks ??
            emptyPicks()
        )
    }

    setPicks(use: PowerUseKey, picks: PowerChoicePicks): void {
        const modifiers = this.session.selection.modifiers
        if (!modifiers.some((m) => samePowerUse(m.use, use))) return
        this.session.selection.set(
            'modifiers',
            modifiers.map((m) => (samePowerUse(m.use, use) ? { use, picks } : m))
        )
    }
}
