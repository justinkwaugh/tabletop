import type { Page } from '@playwright/test'

export type StoredGame = {
    typeId: string
    name: string
    hotseat: boolean
    players: { id: string; name: string; userId?: string }[]
    config?: { examplePosition?: string }
    [field: string]: unknown
}
export type StoredActions = {
    gameId: string
    actions: { type: string; metadata?: Record<string, unknown> }[]
    [field: string]: unknown
}
type LocalStores = { games: StoredGame; actions: StoredActions }

export function readLocalRecords<Store extends keyof LocalStores>(
    page: Page,
    store: Store
): Promise<LocalStores[Store][]> {
    return page.evaluate(
        (store) =>
            new Promise<LocalStores[Store][]>((resolve, reject) => {
                const open = indexedDB.open('tabletop-local')
                open.onerror = () => reject(open.error)
                open.onsuccess = () => {
                    const db = open.result
                    const request = db.transaction(store).objectStore(store).getAll()
                    request.onsuccess = () => {
                        db.close()
                        resolve(request.result)
                    }
                    request.onerror = () => {
                        db.close()
                        reject(request.error)
                    }
                }
            }),
        store
    )
}

export function putLocalRecords<Store extends keyof LocalStores>(
    page: Page,
    store: Store,
    records: readonly LocalStores[Store][]
): Promise<void> {
    return page.evaluate(
        ({ store, records }) =>
            new Promise<void>((resolve, reject) => {
                const open = indexedDB.open('tabletop-local')
                open.onerror = () => reject(open.error)
                open.onsuccess = () => {
                    const db = open.result
                    const transaction = db.transaction(store, 'readwrite')
                    for (const record of records) transaction.objectStore(store).put(record)
                    transaction.oncomplete = () => {
                        db.close()
                        resolve()
                    }
                    transaction.onerror = () => {
                        db.close()
                        reject(transaction.error)
                    }
                }
            }),
        { store, records }
    )
}

export async function hostLocalGames(page: Page, seatedPlayerId?: string): Promise<void> {
    const games = await readLocalRecords(page, 'games')
    await putLocalRecords(
        page,
        'games',
        games.map((game) => ({
            ...game,
            hotseat: false,
            players: game.players.map((player) =>
                player.id === seatedPlayerId ? player : { ...player, userId: 'another-user' }
            )
        }))
    )
}
