import { Firestore, type DocumentData } from '@google-cloud/firestore'
import {
    assert,
    assertExists,
    League,
    LeagueSeason,
    type LeagueState,
    type User
} from '@tabletop/common'
import { requestForKey } from './cacheRequests.js'
import * as Value from 'typebox/value'
import { RedisCacheService } from '../../cache/cacheService.js'
import { LeagueError } from '../../competitions/tournamentError.js'
import type { LeagueChange, LeagueStore } from '../stores/leagueStore.js'
import { authorizeCompetitionAccount } from './competitionAuthorization.js'

export class FirestoreLeagueStore implements LeagueStore {
    constructor(
        private readonly cache: RedisCacheService,
        private readonly firestore: Firestore,
        private readonly cachePrefix = 'leagues:v1'
    ) {}

    async create(league: League, user: User): Promise<League> {
        return this.cache.lockWhileWriting([this.key('league', league.id), this.key('list')], () =>
            this.firestore.runTransaction(async (transaction) => {
                await authorizeCompetitionAccount(this.firestore, transaction, user, true)
                const ref = this.document(league.id)
                const existing = this.parseLeague((await transaction.get(ref)).data())
                if (existing) {
                    if (
                        existing.organizerId !== league.organizerId ||
                        existing.name !== league.name ||
                        !Value.Equal(existing.rules, league.rules) ||
                        existing.shape !== league.shape
                    )
                        throw new LeagueError('League ID is already in use')
                    return existing
                }
                transaction.create(ref, league)
                return league
            })
        )
    }

    async read(id: string): Promise<League | undefined> {
        return this.cache.cachingGet<League>(this.key('league', id), async () =>
            this.parseLeague((await this.document(id).get()).data())
        )
    }

    async readSeasons(
        references: { leagueId: string; number: number }[]
    ): Promise<(LeagueSeason | undefined)[]> {
        if (!references.length) return []
        const referencesByKey = new Map(
            references.map((reference) => [
                this.key('season', reference.leagueId, String(reference.number)),
                reference
            ])
        )
        return this.cache.cachingGetMulti<LeagueSeason>(
            [...referencesByKey.keys()],
            async (keys) => {
                const snapshots = await this.firestore.getAll(
                    ...keys.map((key) => {
                        const reference = requestForKey(referencesByKey, key)
                        return this.season(reference.leagueId, reference.number)
                    })
                )
                return snapshots.map((snapshot) => this.parseSeason(snapshot.data()))
            }
        )
    }

    async readSeason(id: string, number: number): Promise<LeagueSeason | undefined> {
        const [season] = await this.readSeasons([{ leagueId: id, number }])
        return season
    }

    async list(): Promise<League[]> {
        const leagues = await this.cache.cachingGet<League[]>(this.key('list'), async () => {
            const snapshot = await this.firestore.collection('leagues').get()
            return snapshot.docs.map((document) => {
                const league = this.parseLeague(document.data())
                assertExists(league, 'League disappeared from query results')
                return league
            })
        })
        return leagues ?? []
    }

    async updateSeason(
        id: string,
        number: number,
        change: (season: LeagueSeason) => void
    ): Promise<LeagueSeason | undefined> {
        return this.cache.lockWhileWriting([this.key('season', id, String(number))], () =>
            this.firestore.runTransaction(async (transaction) => {
                const ref = this.season(id, number)
                const season = this.parseSeason((await transaction.get(ref)).data())
                if (!season) return undefined
                const before = structuredClone(season)
                change(season)
                if (!Value.Equal(before, season)) transaction.set(ref, season)
                return season
            })
        )
    }

    async update(
        id: string,
        user: User | undefined,
        administrative: boolean,
        change: LeagueChange
    ): Promise<LeagueState> {
        return this.cache.lockWhileWriting([this.key('league', id)], (locks) =>
            this.firestore.runTransaction(async (transaction) => {
                if (user)
                    await authorizeCompetitionAccount(
                        this.firestore,
                        transaction,
                        user,
                        administrative
                    )
                const ref = this.document(id)
                const league = this.parseLeague((await transaction.get(ref)).data())
                if (!league) throw new LeagueError('League not found', 404)
                const seasonRef =
                    league.currentSeason === undefined
                        ? undefined
                        : this.season(id, league.currentSeason)
                if (league.currentSeason !== undefined)
                    await locks.addKeys([this.key('season', id, String(league.currentSeason))])
                const season = seasonRef
                    ? this.parseSeason((await transaction.get(seasonRef)).data())
                    : undefined
                if (seasonRef) assertExists(season, 'Current league season is missing')
                const before = structuredClone({ league, season })
                const next = change({ league, season })
                if (next) {
                    assert(
                        next.number === (league.currentSeason ?? -1) + 1,
                        'League seasons must open in order'
                    )
                    await locks.addKeys([this.key('season', id, String(next.number))])
                    league.currentSeason = next.number
                    transaction.create(this.season(id, next.number), next)
                }
                if (!Value.Equal(before.league, league)) {
                    await locks.addKeys([this.key('list')])
                    transaction.set(ref, league)
                }
                if (seasonRef && !Value.Equal(before.season, season))
                    transaction.set(seasonRef, season)
                return { league, season: next ?? season }
            })
        )
    }

    private key(...parts: string[]): string {
        return `${this.cachePrefix}:${JSON.stringify(parts)}`
    }

    private document(id: string) {
        return this.firestore.collection('leagues').doc(id)
    }

    private season(id: string, number: number) {
        return this.document(id).collection('seasons').doc(String(number))
    }

    private parseLeague(data: DocumentData | undefined): League | undefined {
        if (!data) return undefined
        Value.Assert(League, data)
        return data
    }

    private parseSeason(data: DocumentData | undefined): LeagueSeason | undefined {
        if (!data) return undefined
        Value.Assert(LeagueSeason, data)
        return data
    }
}
