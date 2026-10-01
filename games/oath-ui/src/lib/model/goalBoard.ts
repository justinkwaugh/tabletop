import {
    Banner,
    Goal,
    OATHKEEPER_GOALS,
    OathType,
    VISION_GOALS,
    bannerHolder,
    grandScepterHolderId,
    isImperialPlayer,
    relicsAndBannersHeld,
    sitesRuledCount,
    type HydratedOathGameState
} from '@tabletop/oath'
import { nextWin, type NextWin } from './nextWin.js'
import { seatGoals } from './seatGoals.js'

/** What a goal asks for, which is also the symbol it is drawn with. */
export enum GoalKind {
    Sites = 'sites',
    PeoplesFavor = 'peoplesFavor',
    RelicsAndBanners = 'relicsAndBanners',
    DarkestSecret = 'darkestSecret',
    GrandScepter = 'grandScepter'
}

const KIND_OF_GOAL: Record<Goal, GoalKind> = {
    [Goal.MostSites]: GoalKind.Sites,
    [Goal.PeoplesFavor]: GoalKind.PeoplesFavor,
    [Goal.MostRelicsAndBanners]: GoalKind.RelicsAndBanners,
    [Goal.DarkestSecret]: GoalKind.DarkestSecret
}

/** R-3.3.1 — the Successor goal is keyed to the sworn Oath. */
export const SUCCESSOR_KINDS: Record<OathType, GoalKind> = {
    [OathType.Supremacy]: GoalKind.RelicsAndBanners,
    [OathType.ThePeople]: GoalKind.DarkestSecret,
    [OathType.Protection]: GoalKind.PeoplesFavor,
    [OathType.Devotion]: GoalKind.GrandScepter
}

export type GoalCount = { playerId: string; count: number }

/** A goal is a count (a disc per seat, the goal's seat ringed) or a thing one seat holds. */
export type Standing =
    | { shape: 'count'; counts: GoalCount[]; ringedId?: string }
    | { shape: 'holder'; holderId?: string }

export type OathStanding = {
    oathType: OathType
    kind: GoalKind
    holderId?: string
    usurper: boolean
    standing: Standing
}
export type VisionStanding = {
    playerId: string
    visionId: string
    /** R-3.2 — the seat whose revealed Vision it is, when the goal is shared with `playerId`. */
    ownerId?: string
    shared: boolean
    met: boolean
    kind: GoalKind
    standing: Standing
}
export type SuccessorStanding = {
    citizenId: string
    met: boolean
    kind: GoalKind
    standing: Standing
}

/** Every win condition live on the table, for the rail and its enlarged view (R-3). */
export type GoalBoard = {
    next?: NextWin
    oath: OathStanding
    visions: VisionStanding[]
    successors: SuccessorStanding[]
}

function countOf(state: HydratedOathGameState, kind: GoalKind, playerId: string): number {
    return kind === GoalKind.Sites
        ? sitesRuledCount(state, playerId)
        : relicsAndBannersHeld(state, playerId)
}

function holderOf(state: HydratedOathGameState, kind: GoalKind): string | undefined {
    switch (kind) {
        case GoalKind.PeoplesFavor:
            return bannerHolder(state, Banner.PeoplesFavor)
        case GoalKind.DarkestSecret:
            return bannerHolder(state, Banner.DarkestSecret)
        case GoalKind.GrandScepter:
            return grandScepterHolderId(state)
        case GoalKind.Sites:
        case GoalKind.RelicsAndBanners:
            return undefined
    }
}

function standingOf(
    state: HydratedOathGameState,
    kind: GoalKind,
    playerIds: readonly string[],
    ringedId: string | undefined
): Standing {
    if (kind !== GoalKind.Sites && kind !== GoalKind.RelicsAndBanners) {
        return { shape: 'holder', holderId: holderOf(state, kind) }
    }
    const counts = playerIds
        .map((playerId) => ({ playerId, count: countOf(state, kind, playerId) }))
        .sort((a, b) => b.count - a.count)
    return { shape: 'count', counts, ringedId }
}

export function goalBoard(state: HydratedOathGameState): GoalBoard {
    const seatIds = state.turnManager.turnOrder
    const oathKind = KIND_OF_GOAL[OATHKEEPER_GOALS[state.oathType]]
    const holderId = state.oathkeeperPlayerId

    const visions = seatIds.flatMap((playerId) =>
        seatGoals(state, playerId).flatMap((goal): VisionStanding[] => {
            if (goal.kind !== 'vision') return []
            const visionGoal = VISION_GOALS[goal.visionId]
            if (visionGoal === undefined) return []
            const kind = KIND_OF_GOAL[visionGoal]
            const ownerId = goal.shared
                ? seatIds.find((id) => state.getPlayerState(id).revealedVisionId === goal.visionId)
                : undefined
            return [
                {
                    playerId,
                    visionId: goal.visionId,
                    ownerId,
                    shared: goal.shared,
                    met: goal.met,
                    kind,
                    standing: standingOf(state, kind, seatIds, playerId)
                }
            ]
        })
    )

    // R-3.3.1 — under Supremacy a Citizen must hold more relics and banners than every Imperial player.
    const successorKind = SUCCESSOR_KINDS[state.oathType]
    const imperialIds = seatIds.filter((id) => isImperialPlayer(state, id))
    const successors = seatIds.flatMap((citizenId) =>
        seatGoals(state, citizenId).flatMap((goal): SuccessorStanding[] =>
            goal.kind === 'successor'
                ? [
                      {
                          citizenId,
                          met: goal.met,
                          kind: successorKind,
                          standing: standingOf(state, successorKind, imperialIds, citizenId)
                      }
                  ]
                : []
        )
    )

    return {
        next: nextWin(state),
        oath: {
            oathType: state.oathType,
            kind: oathKind,
            holderId,
            usurper: state.oathkeeperIsUsurper === true,
            standing: standingOf(state, oathKind, seatIds, holderId)
        },
        visions,
        successors
    }
}

/** What a disc's tooltip says: the count in words, or the thing held; without a count, what is counted. */
export function standingWords(kind: GoalKind, count?: number): string {
    switch (kind) {
        case GoalKind.Sites:
            if (count === undefined) return 'sites ruled'
            return count === 1 ? '1 site ruled' : `${count} sites ruled`
        case GoalKind.RelicsAndBanners:
            if (count === undefined) return 'relics and banners'
            return count === 1 ? '1 relic or banner' : `${count} relics and banners`
        case GoalKind.PeoplesFavor:
            return "the People's Favor"
        case GoalKind.DarkestSecret:
            return 'the Darkest Secret'
        case GoalKind.GrandScepter:
            return 'the Grand Scepter'
    }
}
