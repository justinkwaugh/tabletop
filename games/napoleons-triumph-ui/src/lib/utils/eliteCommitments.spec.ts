import { describe, expect, it } from 'vitest'
import { Side } from '@tabletop/napoleons-triumph'
import { TestGame } from '@tabletop/napoleons-triumph/testing'
import { eliteCommitments } from './eliteCommitments.js'

function allies() {
    const game = new TestGame()
    game.deployBoth()
    return game.hydrated.playerOf(Side.Allied)
}

function statuses(player: ReturnType<typeof allies>): string[] {
    return eliteCommitments(player).map(({ status }) => status)
}

describe('the Guard and heavy cavalry lines of the armies panel', () => {
    it('give the morale each would cost before it is committed', () => {
        expect(statuses(allies())).toEqual(['−4 morale to commit', '−2 morale to commit'])
    })

    it('give only the morale an army near its last point would really lose', () => {
        const player = allies()
        player.morale = 3
        expect(statuses(player)).toEqual(['−2 morale to commit', '−2 morale to commit'])
        player.morale = 1
        expect(statuses(player)).toEqual(['free to commit', 'free to commit'])
    })

    it('read Committed once committed', () => {
        const player = allies()
        player.guardCommitted = true
        player.heavyCavalryCommitted = true
        expect(statuses(player)).toEqual(['Committed', 'Committed'])
        expect(eliteCommitments(player).every(({ explanation }) => !explanation)).toBe(true)
    })

    it('mark the Guard as failed, and say why, once a Guard Attack has been defeated', () => {
        const player = allies()
        player.guardCommitted = true
        player.guardAttackForfeited = true
        const [guard] = eliteCommitments(player)
        expect(guard.status).toBe('Committed / Failed')
        expect(guard.explanation).toBe(
            'A Guard Attack was defeated: no more Guard Attacks may be made.'
        )
    })
})
