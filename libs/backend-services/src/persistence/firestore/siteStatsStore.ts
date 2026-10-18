import { CollectionReference, FieldPath, Firestore, Query } from '@google-cloud/firestore'
import { BaseError, SiteStatsDay, type UtcDay } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { SiteStatsStore } from '../stores/siteStatsStore.js'
import { SiteDayActiveUsers, type SiteDayRollup } from '../../stats/siteStatsRollup.js'
import { UnknownStorageError } from '../stores/errors.js'

export class FirestoreSiteStatsStore implements SiteStatsStore {
    private readonly days: CollectionReference
    private readonly activeUsers: CollectionReference

    constructor(private readonly firestore: Firestore) {
        this.days = firestore.collection('siteStatsDays')
        this.activeUsers = firestore.collection('siteStatsActiveUsers')
    }

    async saveDay(rollup: SiteDayRollup): Promise<void> {
        const batch = this.firestore.batch()
        batch.set(this.days.doc(rollup.stats.day), rollup.stats)
        batch.set(this.activeUsers.doc(rollup.stats.day), rollup.activeUsers)
        try {
            await batch.commit()
        } catch (error) {
            this.handleError(error, rollup.stats.day)
        }
    }

    async findDays(from: UtcDay, to: UtcDay): Promise<SiteStatsDay[]> {
        const documents = await this.readRange(this.days, from, to)
        return documents.map((data) => {
            Value.Assert(SiteStatsDay, data)
            return data
        })
    }

    async findActiveUsers(from: UtcDay, to: UtcDay): Promise<SiteDayActiveUsers[]> {
        const documents = await this.readRange(this.activeUsers, from, to)
        return documents.map((data) => {
            Value.Assert(SiteDayActiveUsers, data)
            return data
        })
    }

    async findLatestDay(): Promise<UtcDay | undefined> {
        const query = this.days.orderBy('day', 'desc').limit(1)
        const [latest] = await this.read(query, 'latest')
        return latest?.id
    }

    private async readRange(collection: CollectionReference, from: UtcDay, to: UtcDay) {
        const query = collection
            .where(FieldPath.documentId(), '>=', from)
            .where(FieldPath.documentId(), '<=', to)
            .orderBy(FieldPath.documentId())
        return (await this.read(query, `${from}..${to}`)).map((document) => document.data())
    }

    private async read(query: Query, label: string) {
        try {
            return (await query.get()).docs
        } catch (error) {
            this.handleError(error, label)
        }
    }

    private handleError(error: unknown, id: string): never {
        console.error(error)
        if (error instanceof BaseError) throw error
        throw new UnknownStorageError({
            type: 'SiteStats',
            id,
            cause: error instanceof Error ? error : undefined
        })
    }
}
