import type { PouchGood } from '@tabletop/feudum'

/** R-3.3 A pouch good's short name: the tray's choice, the set hand and the reveal line say it. */
export const PouchTitles: Readonly<Record<PouchGood, string>> = {
    saltpeter: '+1 card',
    sulfur: '2 in a row'
}
