import * as Type from 'typebox'
import { readStoredValue, writeStoredValue } from './storedValue'

const rememberedVoteCount = 20
const NoticedVoteIds = Type.Array(Type.String())

function noticedVotesKey(userId: string): string {
    return `noticedPlayerVotes:${userId}`
}

export function readNoticedVoteIds(userId: string): string[] {
    return readStoredValue(noticedVotesKey(userId), NoticedVoteIds) ?? []
}

export function rememberNoticedVote(userId: string, voteId: string): string[] {
    const noticed = [...readNoticedVoteIds(userId).filter((id) => id !== voteId), voteId].slice(
        -rememberedVoteCount
    )
    writeStoredValue(noticedVotesKey(userId), noticed)
    return noticed
}
