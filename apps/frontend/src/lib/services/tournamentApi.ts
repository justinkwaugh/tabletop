import { PUBLIC_API_HOST } from '$env/static/public'
import { Type, type Static, type TSchema } from 'typebox'
import * as Value from 'typebox/value'
import {
    Tournament,
    TournamentDetail,
    TournamentList,
    type TournamentDraft,
    type TournamentListQuery
} from '@tabletop/common'

const ErrorResponse = Type.Object({ error: Type.Object({ message: Type.String() }) })

class TournamentApi {
    list(query: TournamentListQuery) {
        const params = new URLSearchParams({ scope: query.scope })
        if (query.after) params.set('after', query.after)
        if (query.titleId) params.set('titleId', query.titleId)
        return this.request(`/tournaments/?${params}`, TournamentList)
    }

    get(id: string) {
        return this.request(`/tournaments/${encodeURIComponent(id)}`, TournamentDetail)
    }
    create(id: string, draft: TournamentDraft) {
        return this.request('/tournaments/', Tournament, 'POST', { id, draft })
    }
    update(tournament: Tournament, draft: TournamentDraft) {
        return this.request(`/tournaments/${tournament.id}`, Tournament, 'PUT', {
            draft,
            revision: tournament.revision
        })
    }
    act(id: string, operation: 'publish' | 'cancel' | 'lock' | 'leave') {
        return this.request(`/tournaments/${id}/${operation}`, Tournament, 'POST', {})
    }
    join(tournament: Tournament) {
        return this.request(`/tournaments/${tournament.id}/join`, Tournament, 'POST', {})
    }
    private async request<T extends TSchema>(
        path: string,
        schema: T,
        method = 'GET',
        body?: unknown
    ): Promise<Static<T>> {
        const response = await fetch(`${PUBLIC_API_HOST}/api/v1${path}`, {
            method,
            credentials: 'include',
            cache: 'no-store',
            headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body)
        })
        const data: unknown = await response.json()
        if (!response.ok)
            throw new Error(
                Value.Check(ErrorResponse, data)
                    ? data.error.message
                    : 'The request failed. Please try again.'
            )
        const envelope = Type.Object({ status: Type.Literal('ok'), payload: Type.Unknown() })
        Value.Assert(envelope, data)
        Value.Assert(schema, data.payload)
        return data.payload
    }
}

export const tournamentApi = new TournamentApi()
