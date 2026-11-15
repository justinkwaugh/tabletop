import type { League, LeagueSeason, LeagueState, User } from '@tabletop/common'

export type LeagueChange = (state: LeagueState) => LeagueSeason | void

export interface LeagueStore {
    create(league: League, user: User): Promise<League>
    read(id: string): Promise<League | undefined>
    readSeason(id: string, number: number): Promise<LeagueSeason | undefined>
    readSeasons(
        references: { leagueId: string; number: number }[]
    ): Promise<(LeagueSeason | undefined)[]>
    list(): Promise<League[]>
    updateSeason(
        id: string,
        number: number,
        change: (season: LeagueSeason) => void
    ): Promise<LeagueSeason | undefined>
    update(
        id: string,
        user: User | undefined,
        administrative: boolean,
        change: LeagueChange
    ): Promise<LeagueState>
}
