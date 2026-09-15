import type { Tournament, TournamentList } from '@tabletop/common'
import type { TabletopApi } from '@tabletop/frontend-components'

async function inProgressTournaments(
    api: Pick<TabletopApi, 'listTournaments'>,
    titleId: string
): Promise<Tournament[]> {
    const tournaments: Tournament[] = []
    let after: string | undefined
    do {
        const result = await api.listTournaments({ scope: 'mine', titleId, after })
        tournaments.push(
            ...result.tournaments.filter(
                (tournament) => tournament.status === 'inProgress' || tournament.status === 'locked'
            )
        )
        after = result.nextCursor
    } while (after)
    return tournaments
}

export async function loadTitleTournaments(
    api: Pick<TabletopApi, 'listTournaments'>,
    titleId: string,
    after?: string
): Promise<TournamentList> {
    const open = api.listTournaments({ scope: 'open', titleId, after })
    if (after) return open
    const [mine, result] = await Promise.all([inProgressTournaments(api, titleId), open])
    const mineIds = new Set(mine.map((tournament) => tournament.id))
    return {
        ...result,
        tournaments: [
            ...mine,
            ...result.tournaments.filter((tournament) => !mineIds.has(tournament.id))
        ]
    }
}
