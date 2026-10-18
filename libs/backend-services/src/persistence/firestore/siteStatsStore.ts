import { CollectionReference, FieldPath, Firestore, Query } from '@google-cloud/firestore'
import { BaseError, utcMonthOf, type SiteStatsDay, type UtcDayRange } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { SiteStatsStore } from '../stores/siteStatsStore.js'
import {
    StoredSiteStatsMonth,
    type ActiveUserSketches
} from '../model/storedSiteStatsMonth.js'
import { UnknownStorageError } from '../stores/errors.js'

export class FirestoreSiteStatsStore implements SiteStatsStore {
    private readonly months: CollectionReference

    constructor(firestore: Firestore) {
        this.months = firestore.collection('siteStatsMonths')
    }

    async saveDay(stats: SiteStatsDay, activeUsers: ActiveUserSketches): Promise<void> {
        const month = utcMonthOf(stats.day)
        const dayFields = [new FieldPath('days', stats.day), new FieldPath('activeUsers', stats.day)]
        try {
            await this.months
                .doc(month)
                .set(
                    { month, days: { [stats.day]: stats }, activeUsers: { [stats.day]: activeUsers } },
                    { mergeFields: ['month', ...dayFields] }
                )
        } catch (error) {
            this.handleError(error, stats.day)
        }
    }

    async findMonths(range: UtcDayRange): Promise<StoredSiteStatsMonth[]> {
        const query = this.months
            .where('month', '>=', utcMonthOf(range.from))
            .where('month', '<=', utcMonthOf(range.to))
            .orderBy('month')
        return this.read(query, `${range.from}..${range.to}`)
    }

    async findRolledDays(): Promise<Partial<UtcDayRange>> {
        const [first] = await this.read(this.months.orderBy('month').limit(1), 'first')
        const [last] = await this.read(this.months.orderBy('month', 'desc').limit(1), 'last')
        const days = (month: StoredSiteStatsMonth | undefined) => Object.keys(month?.days ?? {}).sort()
        return { from: days(first).at(0), to: days(last).at(-1) }
    }

    private async read(query: Query, label: string): Promise<StoredSiteStatsMonth[]> {
        try {
            return (await query.get()).docs.map((document) => {
                const data = document.data()
                Value.Assert(StoredSiteStatsMonth, data)
                return data
            })
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
