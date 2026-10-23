import { describe, expect, it } from 'vitest'
import { DraftPacketGate } from './draftPacketGate.svelte.js'

function gate(gated: boolean) {
    const view = { gated, key: 'game:1:p1', publishing: false }
    return {
        view,
        gate: new DraftPacketGate({
            gated: () => view.gated,
            key: () => view.key,
            publishing: () => view.publishing
        })
    }
}

describe('DraftPacketGate', () => {
    it('shows an online seat its cards without opening them', () => {
        const { gate: online } = gate(false)
        expect(online.visible).toBe(true)
    })

    it('keeps hotseat cards closed until their player opens them', () => {
        const { gate: hotseat } = gate(true)
        expect(hotseat.visible).toBe(false)
        hotseat.reveal()
        expect(hotseat.visible).toBe(true)
        hotseat.hide()
        expect(hotseat.visible).toBe(false)
    })

    it('closes hotseat cards when the next action or seat comes up', () => {
        const { view, gate: hotseat } = gate(true)
        hotseat.reveal()
        view.key = 'game:2:p2'
        expect(hotseat.visible).toBe(false)
    })

    it('closes hotseat cards while a new state is presented', () => {
        const { view, gate: hotseat } = gate(true)
        hotseat.reveal()
        view.publishing = true
        expect(hotseat.visible).toBe(false)
    })
})
