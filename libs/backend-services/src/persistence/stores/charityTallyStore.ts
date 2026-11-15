import type { CharityTally } from '@tabletop/common'
import type { StoredCharityTally } from '../model/storedCharityTally.js'

export interface CharityTallyStore {
    saveTally(record: StoredCharityTally): Promise<void>
    findTally(): Promise<CharityTally | undefined>
}
