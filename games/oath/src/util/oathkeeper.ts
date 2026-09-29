import { HydratedOathGameState } from '../model/gameState.js'
import { Banner, OathType, PlayerStatus } from '../model/oathEnums.js'
import { isImperialPlayer, sitesRuledBy } from './rule.js'
import { holdsGrandScepter } from './imperial.js'
import { countOf } from './warbands.js'

// Side-effect free: R-2.11-H1 re-evaluates them after every action.

/** R-3.2 — three Visions drawn from the world deck; a discard-pile draw does not count (R-2.7.1). */
export const VISIONS_DRAWN_GATE = 3

/** R-2.11, R-3.2.a */
export enum Goal {
    MostSites = 'mostSites',
    PeoplesFavor = 'peoplesFavor',
    MostRelicsAndBanners = 'mostRelicsAndBanners',
    DarkestSecret = 'darkestSecret'
}

/** R-2.11 */
export const OATHKEEPER_GOALS: Readonly<Record<OathType, Goal>> = {
    [OathType.Supremacy]: Goal.MostSites,
    [OathType.ThePeople]: Goal.PeoplesFavor,
    [OathType.Protection]: Goal.MostRelicsAndBanners,
    [OathType.Devotion]: Goal.DarkestSecret
}

/** R-3.2.a, R-2.7.2 — the Conspiracy has no goal. */
export const VISION_GOALS: Readonly<Record<string, Goal>> = {
    'vision.conquest': Goal.MostSites,
    'vision.rebellion': Goal.PeoplesFavor,
    'vision.sanctuary': Goal.MostRelicsAndBanners,
    'vision.faith': Goal.DarkestSecret
}

export function bannerHolder(state: HydratedOathGameState, banner: Banner): string | undefined {
    return state.banners[banner].holderPlayerId
}

/** R-2.11, R-3.2.a, R-3.3.1 — R-2.3's Reliquary exclusion holds because it is never in `relicIds`. */
export function relicsAndBannersHeld(state: HydratedOathGameState, playerId: string): number {
    const player = state.getPlayerState(playerId)

    let held = player.relicIds.length
    for (const banner of Object.values(Banner)) {
        if (bannerHolder(state, banner) === playerId) held += 1
    }
    return held
}

export function sitesRuledCount(state: HydratedOathGameState, playerId: string): number {
    return sitesRuledBy(state, playerId).length
}

// R-2.11.b — ties qualify for the title; R-3.2-H1 makes a tie no win. Zero never qualifies (R-9.1).
function playersAtMaximum(counts: Map<string, number>): string[] {
    let max = 0
    for (const count of counts.values()) {
        if (count > max) max = count
    }
    if (max === 0) return []
    return [...counts.entries()].filter(([, count]) => count === max).map(([id]) => id)
}

/** Without R-2.11.d's Imperial collapse, which is about the title only. */
export function playersMeetingGoal(state: HydratedOathGameState, goal: Goal): string[] {
    switch (goal) {
        case Goal.PeoplesFavor: {
            const holder = bannerHolder(state, Banner.PeoplesFavor)
            return holder ? [holder] : []
        }
        case Goal.DarkestSecret: {
            const holder = bannerHolder(state, Banner.DarkestSecret)
            return holder ? [holder] : []
        }
        case Goal.MostSites:
            return playersAtMaximum(
                new Map(state.players.map((p) => [p.playerId, sitesRuledCount(state, p.playerId)]))
            )
        case Goal.MostRelicsAndBanners:
            return playersAtMaximum(
                new Map(
                    state.players.map((p) => [p.playerId, relicsAndBannersHeld(state, p.playerId)])
                )
            )
    }
}

/** R-2.11.d — under Supremacy the Empire's tie goes to the Chancellor; other Oaths are held personally. */
export function playersMeetingOathkeeperGoal(state: HydratedOathGameState): string[] {
    const goal = OATHKEEPER_GOALS[state.oathType]
    const qualifying = playersMeetingGoal(state, goal)
    if (goal !== Goal.MostSites) return qualifying

    const chancellorId = state.chancellorId()
    if (!qualifying.includes(chancellorId)) return qualifying
    return qualifying.filter(
        (playerId) =>
            playerId === chancellorId ||
            state.getPlayerState(playerId).status !== PlayerStatus.Citizen
    )
}

export function revealedVisionGoal(
    state: HydratedOathGameState,
    playerId: string
): Goal | undefined {
    const revealed = state.getPlayerState(playerId).revealedVisionId
    return revealed ? VISION_GOALS[revealed] : undefined
}

/** R-2.2.1's own space first, then every revealed Vision a warband of theirs stands on (False Prophet). */
export function revealedVisionIdsOf(state: HydratedOathGameState, playerId: string): string[] {
    const player = state.getPlayerState(playerId)
    const own = player.revealedVisionId
    const alsoRevealed = state.players
        .map((holder) => holder.revealedVisionId)
        .filter(
            (visionId): visionId is string =>
                visionId !== undefined &&
                visionId !== own &&
                countOf(state.warbandsOnCard(visionId), player.color) > 0
        )
    return own ? [own, ...alsoRevealed] : alsoRevealed
}

/** R-3.2 — the Wake Phase condition is `victory.ts`'s. */
export function visionsMetBy(state: HydratedOathGameState, playerId: string): string[] {
    if (state.visionsDrawn < VISIONS_DRAWN_GATE) return []

    // R-3.2-H1 — "the most" is strictly more than every other player.
    return revealedVisionIdsOf(state, playerId).filter((visionId) => {
        const goal = VISION_GOALS[visionId]
        if (goal === undefined) return false
        const qualifying = playersMeetingGoal(state, goal)
        return qualifying.length === 1 && qualifying[0] === playerId
    })
}

export function meetsRevealedVisionGoal(state: HydratedOathGameState, playerId: string): boolean {
    return visionsMetBy(state, playerId).length > 0
}

/** R-3.3.1 — strictly more than the Chancellor and other Citizens; Exiles are not compared. */
export function meetsSuccessorGoal(state: HydratedOathGameState, playerId: string): boolean {
    const player = state.getPlayerState(playerId)
    if (player.status !== PlayerStatus.Citizen) return false

    switch (state.oathType) {
        case OathType.Supremacy: {
            const mine = relicsAndBannersHeld(state, playerId)
            return state.players.every((other) => {
                if (other.playerId === playerId) return true
                if (!isImperialPlayer(state, other.playerId)) return true
                return mine > relicsAndBannersHeld(state, other.playerId)
            })
        }
        case OathType.ThePeople:
            return bannerHolder(state, Banner.DarkestSecret) === playerId
        case OathType.Protection:
            return bannerHolder(state, Banner.PeoplesFavor) === playerId
        case OathType.Devotion:
            return holdsGrandScepter(state, playerId)
    }
}

export function citizensMeetingSuccessorGoal(state: HydratedOathGameState): string[] {
    return state.players
        .filter((player) => meetsSuccessorGoal(state, player.playerId))
        .map((player) => player.playerId)
}
