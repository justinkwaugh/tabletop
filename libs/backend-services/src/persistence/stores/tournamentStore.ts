import type {
    Tournament,
    TournamentEntrant,
    TournamentList,
    TournamentListQuery,
    TournamentStage,
    User
} from '@tabletop/common'

export interface TournamentRegistration {
    tournament: Tournament
    entrants: TournamentEntrant[]
    stage?: TournamentStage
}

export interface TournamentStore {
    create(tournament: Tournament, user: User): Promise<Tournament>
    read(id: string): Promise<TournamentRegistration | undefined>
    list(user: User, query: TournamentListQuery): Promise<TournamentList>
    update(
        id: string,
        user: User | undefined,
        administrative: boolean,
        change: (registration: TournamentRegistration) => void
    ): Promise<TournamentRegistration>
    due(now: number): Promise<string[]>
    administratorIds(): Promise<string[]>
}
