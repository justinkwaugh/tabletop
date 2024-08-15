import { DataToken } from '../../tokens/dataToken.js'

export interface TokenStore {
    find(id: string): Promise<DataToken | undefined>
    create(token: DataToken): Promise<DataToken>
    delete(id: string): Promise<void>
}
