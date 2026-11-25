import { beforeEach, describe, expect, it } from 'vitest'
import { stubLocalStorage } from '$lib/test/localStorageStub'
import { readNoticedVoteIds, rememberNoticedVote } from './voteNotice.js'

beforeEach(() => {
    stubLocalStorage()
})

describe('vote notice', () => {
    it('remembers noticed votes, newest last, up to twenty', () => {
        expect(readNoticedVoteIds('u1')).toEqual([])

        for (let index = 0; index < 22; index++) {
            rememberNoticedVote('u1', `v${index}`)
        }
        rememberNoticedVote('u1', 'v5')

        const noticed = readNoticedVoteIds('u1')
        expect(noticed).toHaveLength(20)
        expect(noticed.at(-1)).toBe('v5')
        expect(noticed).not.toContain('v0')
        expect(noticed.filter((id) => id === 'v5')).toHaveLength(1)
    })

    it('keeps each account’s noticed votes apart', () => {
        rememberNoticedVote('u1', 'v1')

        expect(readNoticedVoteIds('u2')).toEqual([])
    })
})
