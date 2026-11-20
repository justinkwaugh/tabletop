import { assertExists } from '@tabletop/common'
import {
    GuildById,
    Mandates,
    RoyalWrits,
    type Good,
    type HydratedFeudumGameState,
    type MandateAlternative,
    type MandateAlternativeId,
    type PlayMandateOffer,
    type WritId
} from '@tabletop/feudum'

type SupplyCounts = Pick<HydratedFeudumGameState['supply'], 'vessels'>

/** R-7 What a writ is called in a row: a mandate by its number, a charter by its wording. */
export function writName(writId: WritId): string {
    const writ = RoyalWrits.find(({ id }) => id === writId)
    assertExists(writ, `R-7 ${writId} is a writ`)
    return 'number' in writ ? `Mandate ${writ.number}` : writ.text
}

/** R-4.4.2 A turn-in mandate's alternatives as printed, A first. */
function printedAlternatives(writId: WritId): readonly MandateAlternative[] {
    const mandate = Mandates.find(({ id }) => id === writId)
    return mandate?.kind === 'turn-in' ? mandate.alternatives : []
}

/** R-4.8.2 A weapon's alternative, in the rulebook's words. */
export function weaponLabel(writId: WritId, alternative: MandateAlternativeId): string {
    return printedAlternatives(writId).find(({ id }) => id === alternative)?.text ?? writId
}

function counted(goods: readonly Good[]): string {
    return [...new Set(goods)]
        .map((good) => `${goods.filter((one) => one === good).length} ${good}`)
        .join(', ')
}

function rewardText(reward: PlayMandateOffer['reward'], supply?: SupplyCounts): string {
    switch (reward.kind) {
        case 'shillings':
            return `${reward.amount}s`
        case 'attack':
            return `+${reward.amount} attack`
        case 'vessel': {
            const name = reward.vessel.replaceAll('-', ' ')
            // Contract, Supply: a vessel reward says how many the general supply has left.
            return supply ? `${name} · ${supply.vessels[reward.vessel]} left` : name
        }
        case 'goods':
        case 'influence':
        case 'seal':
        case 'bead':
            return `${reward.amount} ${reward.kind}`
    }
}

/** R-4.4.2 S50 "A: 1 food → 3s": the letter and what is turned in, or the guild, and the reward. */
export function mandateChoiceLabel(
    { writId, alternative, turnedIn, reward, rewardGuild }: PlayMandateOffer,
    supply?: SupplyCounts
): string {
    const gain = rewardText(reward, supply)
    if (rewardGuild) {
        return `${GuildById[rewardGuild].name} → ${gain}`
    }
    const printed = printedAlternatives(writId).findIndex(({ id }) => id === alternative)
    const letter = String.fromCodePoint(65 + printed)
    return turnedIn.length > 0 ? `${letter}: ${counted(turnedIn)} → ${gain}` : `${letter}: ${gain}`
}
