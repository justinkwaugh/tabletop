import { describe, expect, it } from 'vitest'
import { mergerRows, type MergerHolder, type PreviewSingle } from './mergerPreview.js'

describe('mergerRows', () => {
    const holder = (key: string, held: [number, number], shares: number): MergerHolder => ({
        key,
        playerId: key,
        held,
        shares
    })
    const single: PreviewSingle = {
        playerId: 'b',
        companyId: 'BO',
        price: 71,
        tradeUp: true,
        chosen: true,
        decided: false,
        canTradeUp: true,
        canSell: true,
        sellFails: false
    }

    it('lists holders by system shares, then the bank, then the donated share', () => {
        const rows = mergerRows(
            [holder('a', [1, 1], 1), holder('b', [3, 2], 2), holder('c', [0, 0], 0)],
            [
                { key: 'pool', label: 'Bank pool', held: [0, 0], shares: 0 },
                { key: 'ipo', label: 'IPO', held: [2, 3], shares: 5 }
            ],
            [single],
            'b'
        )
        expect(rows.map((row) => row.key)).toEqual(['b', 'a', 'ipo', 'charter'])
        expect(rows[0]).toMatchObject({ director: true, single })
        expect(rows[1].director).toBe(false)
        expect(rows[3].shares).toBe(1)
    })

    it('has no donated share when the merger fails', () => {
        const rows = mergerRows([holder('a', [1, 1], 1)], [], [], undefined)
        expect(rows.map((row) => row.key)).toEqual(['a'])
    })
})
