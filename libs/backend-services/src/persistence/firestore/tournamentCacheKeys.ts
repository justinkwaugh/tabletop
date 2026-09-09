import type { Tournament, TournamentListQuery } from '@tabletop/common'

export class TournamentCacheKeys {
    constructor(private readonly prefix = 'tournaments:v1') {}

    key(...parts: string[]): string {
        return `${this.prefix}:${JSON.stringify(parts)}`
    }

    listFamily(scope: TournamentListQuery['scope'], userId = ''): string {
        return this.key('list', scope, userId)
    }

    lists(tournament: Tournament | undefined): string[] {
        if (!tournament) return []
        const keys = tournament.entrants.map((entrant) => this.listFamily('mine', entrant.userId))
        const status = tournament.status
        if (status === 'draft' || status === 'open') keys.push(this.listFamily(status))
        else if (status === 'locked' || status === 'inProgress')
            keys.push(this.listFamily('inProgress'))
        return keys
    }
}
