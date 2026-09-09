import { FieldPath, Firestore, Transaction } from '@google-cloud/firestore'
import {
    Role,
    Tournament,
    TournamentEntrant,
    TournamentStage,
    UserStatus,
    type User,
    type TournamentListQuery,
    type TournamentList
} from '@tabletop/common'
import * as Value from 'typebox/value'
import type { TournamentRegistration, TournamentStore } from '../stores/tournamentStore.js'
import { TournamentError } from '../../competitions/tournamentError.js'

export class FirestoreTournamentStore implements TournamentStore {
    constructor(private readonly firestore: Firestore) {}

    async create(tournament: Tournament, user: User): Promise<Tournament> {
        return this.firestore.runTransaction(async (transaction) => {
            await this.authorize(transaction, user, true)
            const ref = this.document(tournament.id)
            const existing = (await transaction.get(ref)).data()
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
            transaction.create(ref, tournament)
            return tournament
        })
    }

    async read(id: string): Promise<TournamentRegistration | undefined> {
        return this.firestore.runTransaction(async (transaction) => this.load(transaction, id))
    }

    async list(user: User, query: TournamentListQuery): Promise<TournamentList> {
        const collection =
            query.scope === 'mine'
                ? this.firestore.collection('users').doc(user.id).collection('tournamentEntries')
                : this.firestore.collection('tournaments')
        let request =
            query.scope === 'mine'
                ? collection
                : query.scope === 'inProgress'
                  ? collection.where('status', 'in', ['locked', 'inProgress'])
                  : collection.where('status', '==', query.scope)
        if (query.titleId)
            request = request.where(
                query.scope === 'mine' ? 'titleId' : 'rules.titleId',
                '==',
                query.titleId
            )
        request = request.orderBy(FieldPath.documentId())
        if (query.after) request = request.startAfter(query.after)
        const page = await request.limit(26).get()
        const selected = page.docs.slice(0, 25)
        const documents =
            query.scope === 'mine' && selected.length
                ? await this.firestore.getAll(...selected.map((doc) => this.document(doc.id)))
                : selected
        const tournaments: Tournament[] = []
        for (const document of documents) {
            const data = document.data()
            if (!data) continue
            Value.Assert(Tournament, data)
            tournaments.push(data)
        }
        return { tournaments, ...(page.size > 25 ? { nextCursor: selected.at(-1)?.id } : {}) }
    }

    async update(
        id: string,
        user: User | undefined,
        administrative: boolean,
        change: (registration: TournamentRegistration) => void
    ): Promise<TournamentRegistration> {
        return this.firestore.runTransaction(async (transaction) => {
            if (user) await this.authorize(transaction, user, administrative)
            const registration = await this.load(transaction, id)
            if (!registration) throw new TournamentError('Tournament not found', 404)
            const before = structuredClone(registration)
            change(registration)
            if (Value.Equal(before, registration)) return registration
            const ref = this.document(id)
            transaction.set(ref, registration.tournament)
            for (const entrant of registration.entrants) {
                if (before.entrants.some((existing) => existing.userId === entrant.userId)) continue
                transaction.create(ref.collection('entrants').doc(entrant.userId), entrant)
                transaction.set(this.membership(entrant.userId, id), {
                    tournamentId: id,
                    titleId: registration.tournament.rules.titleId
                })
            }
            for (const entrant of before.entrants) {
                if (registration.entrants.some((existing) => existing.userId === entrant.userId))
                    continue
                transaction.delete(ref.collection('entrants').doc(entrant.userId))
                transaction.delete(this.membership(entrant.userId, id))
            }
            if (registration.stage && !before.stage)
                transaction.create(
                    ref.collection('stages').doc(registration.stage.id),
                    registration.stage
                )
            return registration
        })
    }

    async due(now: number): Promise<string[]> {
        const documents = await this.firestore
            .collection('tournaments')
            .where('status', '==', 'open')
            .where('rules.registration.closesAt', '<=', now)
            .limit(100)
            .get()
        return documents.docs.map((document) => document.id)
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

    private document(id: string) {
        return this.firestore.collection('tournaments').doc(id)
    }

    private membership(userId: string, tournamentId: string) {
        return this.firestore
            .collection('users')
            .doc(userId)
            .collection('tournamentEntries')
            .doc(tournamentId)
    }

    private async load(
        transaction: Transaction,
        id: string
    ): Promise<TournamentRegistration | undefined> {
        const ref = this.document(id)
        const tournament = (await transaction.get(ref)).data()
        if (!tournament) return undefined
        Value.Assert(Tournament, tournament)
        const entrantDocs = await transaction.get(ref.collection('entrants'))
        const entrants = entrantDocs.docs.map((document) => {
            const entrant = document.data()
            Value.Assert(TournamentEntrant, entrant)
            return entrant
        })
        const stage = (
            await transaction.get(ref.collection('stages').doc(tournament.format.stages[0].id))
        ).data()
        if (stage) Value.Assert(TournamentStage, stage)
        return { tournament, entrants, ...(stage ? { stage } : {}) }
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
