import type { PreferenceRecord } from '@tabletop/common'

export interface PreferenceStore {
    read(userId: string, scopes: readonly string[]): Promise<(PreferenceRecord | undefined)[]>
    update(
        userId: string,
        scopes: readonly string[],
        change: (records: (PreferenceRecord | undefined)[]) => {
            records: PreferenceRecord[]
            changedIndex: number
        }
    ): Promise<PreferenceRecord[]>
}
