import { CollectionReference, FieldPath, Firestore, Query } from '@google-cloud/firestore'
import { BaseError, SiteStatsDay, utcMonthOf, type UtcDayRange } from '@tabletop/common'
import * as Value from 'typebox/value'
import type { RolledDays, SiteStatsStore } from '../stores/siteStatsStore.js'
import {
    ActiveUserSketches,
    StoredSiteStatsMonth,
    type SiteStatsMonth
} from '../model/storedSiteStatsMonth.js'
import { UnknownStorageError } from '../stores/errors.js'

export class FirestoreSiteStatsStore implements SiteStatsStore {
    private readonly months: CollectionReference

    constructor(firestore: Firestore) {
        this.months = firestore.collection('siteStatsMonths')
    }

    async saveDay(stats: SiteStatsDay, activeUsers: ActiveUserSketches): Promise<void> {
        const month = utcMonthOf(stats.day)
        const dayFields = [
            new FieldPath('days', stats.day),
            new FieldPath('activeUsers', stats.day)
        ]
        try {
            await this.months
                .doc(month)
                .set(
                    {
                        month,
                        days: { [stats.day]: stats },
                        activeUsers: { [stats.day]: activeUsers }
                    },
                    { mergeFields: ['month', ...dayFields] }
                )
        } catch (error) {
            this.handleError(error, stats.day)
        }
    }

    async findMonths(range: UtcDayRange): Promise<SiteStatsMonth[]> {
        const query = this.months
            .where('month', '>=', utcMonthOf(range.from))
            .where('month', '<=', utcMonthOf(range.to))
            .orderBy('month')
        return this.read(query, `${range.from}..${range.to}`)
    }

    async findRolledDays(): Promise<RolledDays> {
        const [first] = await this.read(this.months.orderBy('month').limit(1), 'first')
        const [last] = await this.read(this.months.orderBy('month', 'desc').limit(1), 'last')
        const days = (month: StoredSiteStatsMonth | undefined) =>
            Object.keys(month?.days ?? {}).sort()
        const latest = days(last).at(-1)
        return { first: days(first).at(0), latest: latest ? last?.days[latest] : undefined }
    }

    private async read(query: Query, label: string): Promise<SiteStatsMonth[]> {
        try {
            return (await query.get()).docs.map((document) => {
                const stored = document.data()
                Value.Assert(StoredSiteStatsMonth, stored)
                return this.currentDays(stored)
            })
        } catch (error) {
            this.handleError(error, label)
        }
    }

    private currentDays(stored: StoredSiteStatsMonth): SiteStatsMonth {
        const month: SiteStatsMonth = { month: stored.month, days: {}, activeUsers: {} }
        for (const [day, stats] of Object.entries(stored.days)) {
            const activeUsers = stored.activeUsers[day]
            if (!Value.Check(SiteStatsDay, stats) || !Value.Check(ActiveUserSketches, activeUsers))
                continue
            month.days[day] = stats
            month.activeUsers[day] = activeUsers
        }
        return month
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
