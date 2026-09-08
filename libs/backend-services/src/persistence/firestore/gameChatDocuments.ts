import type { Firestore } from '@google-cloud/firestore'

export function gameChatDocument(firestore: Firestore, gameId: string) {
    return firestore.collection('games').doc(gameId).collection('chats').doc(gameId)
}

export function gameChatBookmarks(firestore: Firestore, gameId: string) {
    return gameChatDocument(firestore, gameId).collection('bookmarks')
}
