import { FieldPath, Firestore, Transaction, type DocumentData } from '@google-cloud/firestore'
import {
    assertExists,
    Role,
    Tournament,
    TournamentSchedule,
    UserStatus,
    type User,
    type TournamentListQuery,
    TournamentList,
    TournamentGameReference,
    type TournamentGameLink
} from '@tabletop/common'
import * as Value from 'typebox/value'
import * as Type from 'typebox'
import { nanoid } from 'nanoid'
import { RedisCacheService, type CacheWriteLocks } from '../../cache/cacheService.js'
import type { TournamentStore } from '../stores/tournamentStore.js'
import {
    StoredTournamentSchedule,
    storeTournamentSchedule,
    loadTournamentSchedule
} from '../model/storedTournamentSchedule.js'
import { TournamentError } from '../../competitions/tournamentError.js'
import { updateTournamentRegistration } from '../../competitions/tournamentRegistration.js'
import { reserveTournamentTables } from '../../competitions/tournamentDispatch.js'

import { TournamentCacheKeys } from './tournamentCacheKeys.js'

const CachedTournamentPage = Type.Object({ generation: Type.String(), page: TournamentList })

export class FirestoreTournamentStore implements TournamentStore {
    private readonly cacheKeys: TournamentCacheKeys

    constructor(
        private readonly cache: RedisCacheService,
        private readonly firestore: Firestore,
        cachePrefix = 'tournaments:v1'
    ) {
        this.cacheKeys = new TournamentCacheKeys(cachePrefix)
    }

    async create(tournament: Tournament, user: User): Promise<Tournament> {
        return this.cache.lockWhileWriting([this.cacheKeys.key('event', tournament.id)], (locks) =>
            this.firestore.runTransaction(async (transaction) => {
                await this.authorize(transaction, user, true)
                const ref = this.document(tournament.id)
                const existing = this.parse((await transaction.get(ref)).data())
                if (existing) {
                    Value.Assert(Tournament, existing)
                    if (existing.organizerId !== user.id)
                        throw new TournamentError('Tournament ID is already in use')
                    if (
                        existing.name !== tournament.name ||
                        existing.description !== tournament.description ||
                        !Value.Equal(existing.rules, tournament.rules) ||
                        !Value.Equal(existing.format, tournament.format)
                    )
                        throw new TournamentError(
                            'Tournament ID is already in use with different settings'
                        )
                    return existing
                }
                await this.protectLists(locks, undefined, tournament)
                transaction.create(ref, this.serialize(tournament))
                return tournament
            })
        )
    }

    async read(id: string): Promise<Tournament | undefined> {
        return this.cache.cachingGet<Tournament>(this.cacheKeys.key('event', id), async () =>
            this.parse((await this.document(id).get()).data())
        )
    }

    async readGameLinks(id: string): Promise<TournamentGameLink[]> {
        const links = await this.cache.cachingGet<TournamentGameLink[]>(
            this.cacheKeys.key('games', id),
            async () => {
                const snapshot = await this.firestore
                    .collection('games')
                    .where('tournament.tournamentId', '==', id)
                    .select('tournament')
                    .get()
                return snapshot.docs.map((document) => {
                    const reference = document.data().tournament
                    Value.Assert(TournamentGameReference, reference)
                    return {
                        gameId: document.id,
                        stageId: reference.stageId,
                        tableId: reference.tableId
                    }
                })
            }
        )
        assertExists(links, 'Tournament game links could not be loaded')
        return links
    }

    async list(user: User, query: TournamentListQuery): Promise<TournamentList> {
        const family = this.cacheKeys.listFamily(query.scope, query.scope === 'mine' ? user.id : '')
        const generation = await this.cache.cachingGet<string>(family, async () => nanoid())
        assertExists(generation, 'Tournament list cache generation is missing')
        const pageKey = this.cacheKeys.key('page', family, query.titleId ?? '', query.after ?? '')
        const cached = await this.cache.cacheGet(pageKey)
        if (
            cached.cached &&
            Value.Check(CachedTournamentPage, cached.value) &&
            cached.value.generation === generation
        )
            return cached.value.page
        const page = await this.queryList(user, query)
        await this.cache.set(pageKey, { generation, page }).catch((error) => {
            console.error('Tournament list cache fill failed', error)
        })
        return page
    }

    private async queryList(user: User, query: TournamentListQuery): Promise<TournamentList> {
        const collection = this.firestore.collection('tournaments')
        let request =
            query.scope === 'mine'
                ? collection.where('entrantIds', 'array-contains', user.id)
                : query.scope === 'inProgress'
                  ? collection.where('status', 'in', ['locked', 'inProgress'])
                  : collection.where('status', '==', query.scope)
        if (query.titleId) request = request.where('rules.titleId', '==', query.titleId)
        request = request.orderBy(FieldPath.documentId())
        if (query.after) request = request.startAfter(query.after)
        const page = await request.limit(26).get()
        const selected = page.docs.slice(0, 25)
        const tournaments = selected.map((document) => {
            const tournament = this.parse(document.data())
            if (!tournament) throw new Error('Tournament disappeared from query results')
            return tournament
        })
        return { tournaments, ...(page.size > 25 ? { nextCursor: selected.at(-1)?.id } : {}) }
    }

    async update(
        id: string,
        user: User | undefined,
        administrative: boolean,
        change: (tournament: Tournament) => void
    ): Promise<Tournament> {
        return this.cache.lockWhileWriting([this.cacheKeys.key('event', id)], (locks) =>
            this.firestore.runTransaction(async (transaction) => {
                if (user) await this.authorize(transaction, user, administrative)
                const ref = this.document(id)
                const tournament = this.parse((await transaction.get(ref)).data())
                if (!tournament) throw new TournamentError('Tournament not found', 404)
                const before = structuredClone(tournament)
                change(tournament)
                if (!Value.Equal(before, tournament)) {
                    await this.protectLists(locks, before, tournament)
                    transaction.set(ref, this.serialize(tournament))
                }
                return tournament
            })
        )
    }

    async readSchedule(tournamentId: string, stageId: string): Promise<TournamentSchedule> {
        const stored = await this.cache.cachingGet<StoredTournamentSchedule>(
            this.cacheKeys.key('schedule', tournamentId, stageId),
            async () => {
                const data = (
                    await this.document(tournamentId).collection('schedules').doc(stageId).get()
                ).data()
                Value.Assert(StoredTournamentSchedule, data)
                return data
            }
        )
        assertExists(stored, 'Committed tournament schedule is missing')
        return loadTournamentSchedule(stored)
    }

    async commitSchedule(
        schedule: TournamentSchedule,
        revision: number,
        user: User | undefined,
        now: number
    ): Promise<Tournament> {
        const stored = storeTournamentSchedule(schedule)
        return this.cache.lockWhileWriting(
            [
                this.cacheKeys.key('event', schedule.tournamentId),
                this.cacheKeys.key('schedule', schedule.tournamentId, schedule.stageId)
            ],
            (locks) =>
                this.firestore.runTransaction(async (transaction) => {
                    if (user) await this.authorize(transaction, user, true)
                    const ref = this.document(schedule.tournamentId)
                    const tournament = this.parse((await transaction.get(ref)).data())
                    if (!tournament) throw new TournamentError('Tournament not found', 404)
                    if (
                        tournament.stages.find((stage) => stage.id === schedule.stageId)
                            ?.scheduleId === schedule.id
                    )
                        return tournament
                    if (tournament.revision !== revision)
                        throw new TournamentError(
                            'The tournament changed. Preview its schedule again before saving.'
                        )
                    const before = structuredClone(tournament)
                    if (tournament.status === 'open') updateTournamentRegistration(tournament, now)
                    const stage = tournament.stages.find((stage) => stage.id === schedule.stageId)
                    if (
                        tournament.paused ||
                        tournament.status !== 'locked' ||
                        !stage ||
                        stage.status !== 'awaitingSchedule' ||
                        stage.rosterRevision !== schedule.rosterRevision
                    )
                        throw new TournamentError(
                            'The tournament changed. Preview its schedule again before saving.'
                        )
                    const dispatch = { reserved: [], active: [], finished: [] }
                    stage.dispatch = {
                        ...dispatch,
                        reserved: reserveTournamentTables(tournament, schedule, dispatch)
                    }
                    await this.protectLists(locks, before, tournament)
                    stage.status = 'scheduled'
                    stage.scheduleId = schedule.id
                    stage.scheduledAt = now
                    tournament.nextTaskAt = now
                    tournament.revision++
                    tournament.updatedAt = now
                    transaction.create(ref.collection('schedules').doc(stage.id), stored)
                    transaction.set(ref, this.serialize(tournament))
                    return tournament
                })
        )
    }

    async administratorIds(): Promise<string[]> {
        const accounts = await this.firestore
            .collection('users')
            .where('roles', 'array-contains', Role.Admin)
            .get()
        return accounts.docs
            .filter((account) => account.data().status === UserStatus.Active)
            .map((account) => account.id)
    }

    private async protectLists(
        locks: CacheWriteLocks,
        before: Tournament | undefined,
        after: Tournament
    ): Promise<void> {
        const keys = new Set([...this.cacheKeys.lists(before), ...this.cacheKeys.lists(after)])
        if (keys.size) await locks.addKeys([...keys])
    }

    private document(id: string) {
        return this.firestore.collection('tournaments').doc(id)
    }

    private serialize(tournament: Tournament) {
        return { ...tournament, entrantIds: tournament.entrants.map((entrant) => entrant.userId) }
    }

    private parse(data: DocumentData | undefined): Tournament | undefined {
        if (!data) return undefined
        delete data.entrantIds
        Value.Assert(Tournament, data)
        return data
    }

    private async authorize(transaction: Transaction, user: User, administrative: boolean) {
        const account = (
            await transaction.get(this.firestore.collection('users').doc(user.id))
        ).data()
        if (account?.status !== UserStatus.Active)
            throw new TournamentError('An active account is required', 403)
        if (
            administrative &&
            (!Array.isArray(account.roles) || !account.roles.includes(Role.Admin))
        ) {
            throw new TournamentError('Administrator access is required', 403)
        }
    }
}
