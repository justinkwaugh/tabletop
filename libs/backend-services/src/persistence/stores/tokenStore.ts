import { DataToken } from '../../tokens/dataToken.js'
import type { Transaction } from '@google-cloud/firestore'

export interface TokenStore {
    find(id: string, transaction?: Transaction): Promise<DataToken | undefined>
    create(token: DataToken): Promise<DataToken>
    replace(token: DataToken): Promise<void>
    delete(id: string, transaction?: Transaction): Promise<void>
}
