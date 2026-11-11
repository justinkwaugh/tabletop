import { expect, it } from 'vitest'
import { liftedPrivateBlocks } from './privateRules.js'

const holdings = { companies: [], certificates: [] }

it('lifts the marked privates the title no longer judges blocking', () => {
    const rules = { blocking: (_state: unknown, id: string) => id === 'B' }
    expect(liftedPrivateBlocks(['B', 'H'], rules, holdings)).toEqual(['H'])
    expect(liftedPrivateBlocks([], {}, holdings)).toEqual([])
    expect(() => liftedPrivateBlocks(['B'], {}, holdings)).toThrow('judge them')
})
