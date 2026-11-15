import { describe, expect, it } from 'vitest'
import { DraftPacketGate } from './draftPacketGate.svelte.js'

function gate(ordinaryHotseatPlay: boolean) {
    const source = { ordinaryHotseatPlay, seatTurnKey: 'game:1:p1', publishing: false }
    return {
        source,
        gate: new DraftPacketGate({
            ordinaryHotseatPlay: () => source.ordinaryHotseatPlay,
            seatTurnKey: () => source.seatTurnKey,
            publishing: () => source.publishing
        })
    }
}

const choosing = { packet: ['MS', 'BIG4'], selections: [] }
const waitingWithPicks = { packet: [], selections: [{ cardId: 'MS', price: 30 }] }
const waitingEmpty = { packet: [], selections: [] }

describe('DraftPacketGate', () => {
    it('shows an online seat its cards without opening them', () => {
        const { gate: online } = gate(false)
        expect(online.visible).toBe(true)
        expect(online.panel(choosing, false)).toBe('cards')
        expect(online.canHide(choosing)).toBe(false)
    })

    it('tells an online seat that is not choosing who it is waiting for', () => {
        const { gate: online } = gate(false)
        expect(online.panel(waitingEmpty, false)).toBe('waiting')
        expect(online.panel(waitingWithPicks, false)).toBe('waiting')
    })

    it('leaves the final offer alone while an online seat waits or chooses', () => {
        const { gate: online } = gate(false)
        expect(online.panel(choosing, true)).toBeUndefined()
        expect(online.panel(waitingWithPicks, true)).toBeUndefined()
    })

    it('keeps hotseat cards closed until their player opens them', () => {
        const { gate: hotseat } = gate(true)
        expect(hotseat.visible).toBe(false)
        expect(hotseat.panel(choosing, false)).toBe('cover')
        expect(hotseat.panel(waitingWithPicks, true)).toBe('cover')
        hotseat.reveal()
        expect(hotseat.visible).toBe(true)
        expect(hotseat.panel(choosing, false)).toBe('cards')
        expect(hotseat.canHide(choosing)).toBe(true)
        hotseat.hide()
        expect(hotseat.visible).toBe(false)
    })

    it('has nothing to cover for a hotseat seat with no cards or picks', () => {
        const { gate: hotseat } = gate(true)
        expect(hotseat.panel(waitingEmpty, false)).toBe('waiting')
        expect(hotseat.canHide(waitingEmpty)).toBe(false)
    })

    it('closes hotseat cards when the next action or seat comes up', () => {
        const { source, gate: hotseat } = gate(true)
        hotseat.reveal()
        source.seatTurnKey = 'game:2:p2'
        expect(hotseat.visible).toBe(false)
    })

    it('closes hotseat cards while a new state is presented', () => {
        const { source, gate: hotseat } = gate(true)
        hotseat.reveal()
        source.publishing = true
        expect(hotseat.visible).toBe(false)
    })
})
