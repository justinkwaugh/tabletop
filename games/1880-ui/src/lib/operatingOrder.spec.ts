import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nextOperatingCompany } from '@tabletop/18xx'
import type { State1880 } from '@tabletop/1880'
import { operatingOrderList } from './operatingOrder.js'

// The harness's scenarios are regenerated from bot games, so each position is read for what it
// holds rather than fixed here.
const scenario = (name: string): State1880 =>
    JSON.parse(readFileSync(new URL(`../scenarios/${name}.json`, import.meta.url), 'utf8')).state

const slotsOf = (state: State1880) =>
    operatingOrderList(state).rows.flatMap((row) =>
        row.slots.map((slot) => ({ ...slot, price: row.price }))
    )

it('lists four slots at each par price, ¥100 first, numbered down the list (§IX, §XII)', () => {
    const view = operatingOrderList(scenario('first-share-round'))
    expect(view.rows.map((row) => row.price)).toEqual([100, 90, 80, 70])
    expect(view.rows.flatMap((row) => row.slots.map((slot) => slot.place))).toEqual(
        Array.from({ length: 16 }, (_, index) => index + 1)
    )
    expect(view.trainMarkerId).toBeUndefined()
})

describe.each(['first-share-round', 'interrupting-share-round', 'phase-c-trains', 'finished-game'])(
    'the %s scenario’s operating order',
    (name) => {
        const state = scenario(name)
        const slots = slotsOf(state)
        const company = (id: string) => state.companies.find((entry) => entry.id === id)

        it('holds each priced major in its par slot (§XII)', () => {
            for (const [companyId, slot] of Object.entries(state.parSlots)) {
                const price = company(companyId)?.parPrice
                if (company(companyId)?.closed) continue
                expect(
                    slots.find(
                        (entry) => entry.price === price && entry.place % 4 === (slot + 1) % 4
                    )?.companyId
                ).toBe(companyId)
            }
            const held = slots.flatMap((slot) => (slot.companyId ? [slot.companyId] : []))
            expect(held.sort()).toEqual(
                Object.keys(state.parSlots)
                    .filter((id) => !company(id)?.closed)
                    .sort()
            )
        })

        it('marks the round’s progress and the train marker (§IX, §X)', () => {
            const set = state.operatingSet
            const current = nextOperatingCompany(state)
            for (const slot of slots) {
                if (!slot.companyId) continue
                const entry = company(slot.companyId)
                if (!entry?.floated) expect(slot.standing).toBe('unfloated')
                else if (slot.companyId === current) expect(slot.standing).toBe('current')
                else if (set && !set.completed && set.completedCompanyIds.includes(slot.companyId))
                    expect(slot.standing).toBe('operated')
                else expect(slot.standing).toBe('waiting')
                expect(slot.trainMarker).toBe(slot.companyId === state.trainMarker)
            }
            expect(slots.filter((slot) => slot.standing === 'current').length).toBeLessThanOrEqual(
                1
            )
        })
    }
)

it('gives the round the game ends in once the last 8-train has gone (§XV)', () => {
    const state = scenario('finished-game')
    const view = operatingOrderList(state)
    expect(view.trainMarkerId).toBe(state.trainMarker)
    expect(view.finalRound).toBe((state.lastEightRound ?? 0) + 3)
})
