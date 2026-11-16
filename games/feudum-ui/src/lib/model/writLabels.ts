import {
    GuildById,
    Mandates,
    RoyalWrits,
    type Good,
    type HydratedFeudumGameState,
    type PlayMandateOffer,
    type WritId
} from '@tabletop/feudum'

/** The general supply's counts a label reads. */
type SupplyCounts = Pick<HydratedFeudumGameState['supply'], 'vessels'>

/** R-7 What a writ is called in a row: a mandate by its number, a charter by its wording. */
export function writName(writId: WritId): string {
    const writ = RoyalWrits.find(({ id }) => id === writId)
    if (!writ) {
        return writId
    }
    return 'number' in writ ? `Mandate ${writ.number}` : writ.text
}

/** R-4.8.2 A weapon's alternative, in the rulebook's words. */
export function weaponLabel(writId: WritId, alternative: number): string {
    const mandate = Mandates.find(({ id }) => id === writId)
    return mandate?.kind === 'turn-in' ? mandate.alternatives[alternative].text : writId
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
            // Contract, Supply: a vessel reward says how many the general supply has left; with
            // none left the logic refuses it, and it is not drawn.
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
    { alternative, turnedIn, reward, rewardGuild }: PlayMandateOffer,
    supply?: SupplyCounts
): string {
    const gain = rewardText(reward, supply)
    if (rewardGuild) {
        return `${GuildById[rewardGuild].name} → ${gain}`
    }
    const letter = String.fromCodePoint(65 + alternative)
    return turnedIn.length > 0 ? `${letter}: ${counted(turnedIn)} → ${gain}` : `${letter}: ${gain}`
}
