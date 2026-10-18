import { Good } from '@tabletop/indonesia'

export type MarkerGood = 'spice' | 'siapsaji' | 'oil' | 'rice' | 'rubber'
export type MarkerDirection = 'north' | 'east' | 'south' | 'west'

export const MARKER_GOOD_BY_GOOD: Readonly<Record<Good, MarkerGood>> = {
    [Good.Rice]: 'rice',
    [Good.Spice]: 'spice',
    [Good.Rubber]: 'rubber',
    [Good.Oil]: 'oil',
    [Good.SiapSaji]: 'siapsaji'
}
