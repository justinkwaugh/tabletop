import type {
    Tournament,
    CorrectTournamentResultRequest,
    TournamentList,
    TournamentListQuery,
    TournamentSchedule,
    TournamentGameLink,
    User
} from '@tabletop/common'

export interface TournamentStore {
    create(tournament: Tournament, user: User): Promise<Tournament>
    read(id: string): Promise<Tournament | undefined>
    readGameLinks(id: string): Promise<TournamentGameLink[]>
    list(user: User, query: TournamentListQuery): Promise<TournamentList>
    update(
        id: string,
        user: User | undefined,
        administrative: boolean,
        change: (registration: Tournament) => void
    ): Promise<Tournament>
    readSchedule(tournamentId: string, stageId: string): Promise<TournamentSchedule>
    commitSchedule(
        schedule: TournamentSchedule,
        revision: number,
        user: User | undefined,
        now: number
    ): Promise<Tournament>
    correctResult(
        id: string,
        request: CorrectTournamentResultRequest,
        user: User,
        now: number
    ): Promise<Tournament>
    rebuildStandings(id: string, revision: number, user: User, now: number): Promise<Tournament>
    administratorIds(): Promise<string[]>
}
