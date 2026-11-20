import { assert, assertExists } from '@tabletop/common'
import type { Good, GuildId } from '../data/components.js'
import {
    RoyalWrits,
    type CharterId,
    type MandateAlternativeId,
    type MandateId,
    type MandateReward,
    type RoyalWrit,
    type WritId
} from '../data/writs.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { CharterRegistrations } from './charters.js'
import { MandateRegistrations } from './mandates.js'

/** R-4.4-H1, R-6.2 When a writ's effect applies: at will, in the holder's attack, or at final scoring. */
export type WritTiming = 'at-will' | 'attack' | 'end-scoring'

/** R-X.2 What a mandate reward puts in view: goods drawn from the haversack, or a seal flipped to a bead. */
export type MandateReveal = 'nothing' | 'draw' | 'flip'

/** R-4.4.2, R-7 A turn-in alternative names its printed id, a guild-status reward its guild. */
export interface MandateAlternativeEffect {
    readonly alternative?: MandateAlternativeId
    readonly turnedIn: readonly Good[]
    readonly reward: MandateReward
    /** R-4.4.2 A reward taken only for a guild where its player has the status stars. */
    readonly rewardGuild?: GuildId
    readonly reveals: MandateReveal
}

/** R-4.4-H1, R-4.8.2 */
export interface WeaponBonus {
    readonly alternative: MandateAlternativeId
    readonly turnedIn: readonly Good[]
    readonly attack: number
}

export interface MandateRegistration {
    readonly writId: MandateId
    readonly timing: 'at-will'
    readonly printedText: string
    readonly alternatives: readonly MandateAlternativeEffect[]
}

export interface WeaponRegistration {
    readonly writId: MandateId
    readonly timing: 'attack'
    readonly printedText: string
    readonly bonuses: readonly WeaponBonus[]
}

export interface CharterRegistration {
    readonly writId: CharterId
    readonly timing: 'end-scoring'
    readonly printedText: string
    readonly score: (state: HydratedFeudumGameState, playerId: string) => number
}

export type WritRegistration = MandateRegistration | WeaponRegistration | CharterRegistration

/** R-6.2 One sealed charter, revealed with what it scores. */
export interface CharterScore {
    readonly writId: WritId
    readonly vp: number
}

/**
 * R-4.4 Writ effects by writ id and timing. Actions and the scorer read them only through these
 * queries, never by testing a writ id. A writ with no registration gives nothing, and the `reason`
 * queries give what an action refuses with.
 */
export class WritRegistry {
    private readonly mandates = new Map<WritId, MandateRegistration>()
    private readonly weapons = new Map<WritId, WeaponRegistration>()
    private readonly charters = new Map<WritId, CharterRegistration>()

    /** R-4.4 */
    register(registration: WritRegistration): void {
        const { writId, timing, printedText } = registration
        const writ = RoyalWrits.find((royalWrit) => royalWrit.id === writId)
        assertExists(writ, `No Royal Writ has the id ${writId}`)
        assert(
            WritRegistry.timingOf(writ) === timing,
            `${writId} applies ${WritRegistry.timingOf(writ)}, not ${timing}`
        )
        assert(printedText.trim() !== '', `${writId} is registered without its printed text`)
        assert(
            !this.registrations().some(
                (known) => known.writId === writId && known.timing === timing
            ),
            `${writId} is already registered ${timing}`
        )
        switch (registration.timing) {
            case 'at-will':
                assert(registration.alternatives.length > 0, `${writId} has no alternative`)
                this.mandates.set(writId, registration)
                break
            case 'attack':
                assert(registration.bonuses.length > 0, `${writId} has no alternative`)
                this.weapons.set(writId, registration)
                break
            case 'end-scoring':
                this.charters.set(writId, registration)
                break
        }
    }

    /** Every registration with its printed text, for the reach sweeps. */
    registrations(): WritRegistration[] {
        return [...this.mandates.values(), ...this.weapons.values(), ...this.charters.values()]
    }

    /** R-4.4.2 What the writ offers at will. Weapons offer nothing here (R-4.4-H1). */
    mandateAlternatives(writId: WritId): readonly MandateAlternativeEffect[] {
        return this.mandates.get(writId)?.alternatives ?? []
    }

    /** R-4.4.2 A turn-in alternative by its id, a guild-status reward by its guild; never both. */
    mandateAlternative(
        writId: WritId,
        alternative?: MandateAlternativeId,
        rewardGuild?: GuildId
    ): MandateAlternativeEffect | undefined {
        if ((alternative === undefined) === (rewardGuild === undefined)) {
            return undefined
        }
        return this.mandateAlternatives(writId).find(
            (effect) => effect.alternative === alternative && effect.rewardGuild === rewardGuild
        )
    }

    /** R-4.4.2 */
    reasonMandateRefused(
        writId: WritId,
        alternative?: MandateAlternativeId,
        rewardGuild?: GuildId
    ): string | undefined {
        if (!this.mandates.has(writId)) {
            return `${writId} has no at-will effect`
        }
        if (this.mandateAlternative(writId, alternative, rewardGuild) === undefined) {
            return `${writId} has no such alternative: ${rewardGuild ?? alternative ?? 'none'}`
        }
        return undefined
    }

    /** R-4.4-H1, R-4.8.2 What the weapon adds in its holder's attack; nothing at will. */
    weaponBonuses(writId: WritId): readonly WeaponBonus[] {
        return this.weapons.get(writId)?.bonuses ?? []
    }

    /** R-4.4-H1, R-4.8.2 */
    weaponBonus(writId: WritId, alternative: MandateAlternativeId): WeaponBonus | undefined {
        return this.weaponBonuses(writId).find((bonus) => bonus.alternative === alternative)
    }

    /** R-4.4-H1, R-4.8.2 */
    reasonWeaponRefused(writId: WritId, alternative: MandateAlternativeId): string | undefined {
        if (!this.weapons.has(writId)) {
            return `${writId} has no effect in an attack`
        }
        if (this.weaponBonus(writId, alternative) === undefined) {
            return `${writId} has no such alternative: ${alternative}`
        }
        return undefined
    }

    /** R-4.4.3, R-6.2 What this charter pays this seat, sealed or not: final scoring reads the next. */
    charterScore(
        writId: WritId,
        state: HydratedFeudumGameState,
        playerId: string
    ): number | undefined {
        return this.charters.get(writId)?.score(state, playerId)
    }

    /** R-4.4.3, R-6.2 Only sealed charters score, each with its row even at 0; no other writ does. */
    sealedCharterScores(state: HydratedFeudumGameState, playerId: string): CharterScore[] {
        return state
            .getPlayerState(playerId)
            .requireSealedCharters()
            .map((writId) => ({ writId, vp: this.charterScore(writId, state, playerId) ?? 0 }))
    }

    /** R-4.4.3 */
    reasonCharterRefused(writId: WritId): string | undefined {
        return this.charters.has(writId) ? undefined : `${writId} has no end scoring`
    }

    /** R-4.4-H1, R-4.4.3 The one timing each writ has. */
    private static timingOf(writ: RoyalWrit): WritTiming {
        switch (writ.kind) {
            case 'turn-in':
            case 'guild-status':
                return writ.weapon ? 'attack' : 'at-will'
            case 'kingdom':
            case 'sulfur-barrel':
            case 'monster-defeat':
                return 'end-scoring'
        }
    }
}

/**
 * The game's registry. It takes its registrations here, not from modules that add to it on load: the
 * package declares no side effects, so a bundler may drop a module imported only for that.
 */
export const writRegistry = new WritRegistry()
for (const registration of [...MandateRegistrations, ...CharterRegistrations]) {
    writRegistry.register(registration)
}
