import {
    Goal,
    OATHKEEPER_GOALS,
    OathType,
    isImperialPlayer,
    relicsAndBannersHeld,
    sitesRuledCount,
    type HydratedOathGameState
} from '@tabletop/oath'
import { nextWin, type NextWin } from './nextWin.js'
import { seatGoals } from './seatGoals.js'

export type GoalCount = { playerId: string; count: number }
export enum TallyUnit {
    Sites = 'sites',
    RelicsAndBanners = 'relicsAndBanners'
}
export type GoalTally = { unit: TallyUnit; counts: GoalCount[] }

export function tallyLabel(unit: TallyUnit, count: number): string {
    switch (unit) {
        case TallyUnit.Sites:
            return count === 1 ? '1 site' : `${count} sites`
        case TallyUnit.RelicsAndBanners:
            return count === 1 ? '1 relic or banner' : `${count} relics and banners`
    }
}

export type OathStanding = {
    oathType: OathType
    holderId?: string
    usurper: boolean
    tally?: GoalTally
}
export type VisionStanding = { playerId: string; visionId: string; shared: boolean; met: boolean }
export type SuccessorStanding = {
    citizens: { playerId: string; met: boolean }[]
    tally?: GoalTally
}

/** Every win condition live on the table, for the rail and its enlarged view (R-3). */
export type GoalBoard = {
    next?: NextWin
    oath: OathStanding
    visions: VisionStanding[]
    successor?: SuccessorStanding
}

function tally(
    state: HydratedOathGameState,
    goal: Goal,
    playerIds: readonly string[]
): GoalTally | undefined {
    switch (goal) {
        case Goal.MostSites:
            return {
                unit: TallyUnit.Sites,
                counts: counted(playerIds, (id) => sitesRuledCount(state, id))
            }
        case Goal.MostRelicsAndBanners:
            return {
                unit: TallyUnit.RelicsAndBanners,
                counts: counted(playerIds, (id) => relicsAndBannersHeld(state, id))
            }
        case Goal.PeoplesFavor:
        case Goal.DarkestSecret:
            return undefined
    }
}

function counted(playerIds: readonly string[], count: (playerId: string) => number): GoalCount[] {
    return playerIds
        .map((playerId) => ({ playerId, count: count(playerId) }))
        .sort((a, b) => b.count - a.count)
}

export function goalBoard(state: HydratedOathGameState): GoalBoard {
    const seatIds = state.turnManager.turnOrder
    const visions = seatIds.flatMap((playerId) =>
        seatGoals(state, playerId).flatMap((goal) =>
            goal.kind === 'vision'
                ? [{ playerId, visionId: goal.visionId, shared: goal.shared, met: goal.met }]
                : []
        )
    )
    const successorGoals = seatIds.flatMap((playerId) =>
        seatGoals(state, playerId).flatMap((goal) =>
            goal.kind === 'successor' ? [{ playerId, met: goal.met }] : []
        )
    )
    // R-3.3.1 — under Supremacy a Citizen must hold more relics and banners than every Imperial player.
    const imperialIds = seatIds.filter((id) => isImperialPlayer(state, id))
    return {
        next: nextWin(state),
        oath: {
            oathType: state.oathType,
            holderId: state.oathkeeperPlayerId,
            usurper: state.oathkeeperIsUsurper === true,
            tally: tally(state, OATHKEEPER_GOALS[state.oathType], seatIds)
        },
        visions,
        successor:
            successorGoals.length === 0
                ? undefined
                : {
                      citizens: successorGoals,
                      tally:
                          state.oathType === OathType.Supremacy
                              ? tally(state, Goal.MostRelicsAndBanners, imperialIds)
                              : undefined
                  }
    }
}
