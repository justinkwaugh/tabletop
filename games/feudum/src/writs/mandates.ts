import { Mandates, type Mandate, type MandateReward } from '../data/writs.js'
import type { MandateRegistration, MandateReveal, WeaponRegistration } from './writRegistry.js'

/** R-X.2 What a reward puts in view: goods drawn from the haversack, or a seal flipped to a bead. */
function revealOf(reward: MandateReward): MandateReveal {
    switch (reward.kind) {
        case 'goods':
            return 'draw'
        case 'bead':
            return 'flip'
        default:
            return 'nothing'
    }
}

/**
 * R-4.4.2, R-4.4-H1, R-4.8.2, R-7 A mandate's registration, read from the card's own row, which
 * holds its printed text beside its values: a weapon's alternatives apply in its holder's attack,
 * any other mandate's at will, by index or by the guild pictured.
 */
function registrationOf(mandate: Mandate): MandateRegistration | WeaponRegistration {
    const writId = mandate.id
    if (mandate.kind === 'guild-status') {
        return {
            writId,
            timing: 'at-will',
            printedText: mandate.text,
            alternatives: mandate.guildRewards.map(({ guild, reward }) => ({
                turnedIn: [],
                reward,
                rewardGuild: guild,
                reveals: revealOf(reward)
            }))
        }
    }
    const printedText = mandate.alternatives.map(({ text }) => text).join(' / ')
    if (mandate.weapon) {
        return {
            writId,
            timing: 'attack',
            printedText,
            bonuses: mandate.alternatives.flatMap(({ turnedIn, reward }) =>
                reward.kind === 'attack' ? [{ turnedIn, attack: reward.amount }] : []
            )
        }
    }
    return {
        writId,
        timing: 'at-will',
        printedText,
        alternatives: mandate.alternatives.map(({ turnedIn, reward }) => ({
            turnedIn,
            reward,
            reveals: revealOf(reward)
        }))
    }
}

/** R-4.4.2 The eight mandates. */
export const MandateRegistrations = Mandates.map(registrationOf)
