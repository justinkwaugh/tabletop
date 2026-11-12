import type { BattleMap, RoadHalt } from '@tabletop/napoleons-triumph'
import { corpsName } from './groupNames.js'

const HALT_RULE = 'a corps of two or more units stops next to an enemy corps of two or more'

function haltPlaces(map: BattleMap, halts: readonly RoadHalt[]): string {
    return halts
        .map((halt) => `${map.label(halt.locale)}, beside ${corpsName(halt.enemyCommanderId)}`)
        .join('; or ')
}

export function attackHaltNote(map: BattleMap, halt: RoadHalt): string {
    return `Moving together by road, these cavalry must halt on entering ${haltPlaces(map, [halt])}: ${HALT_RULE}. Pick one of them to make this attack.`
}

export function marchHaltNote(map: BattleMap, halts: readonly RoadHalt[]): string | undefined {
    if (halts.length === 0) {
        return undefined
    }
    return `Moving together by road, these units must halt on entering ${haltPlaces(map, halts)}: ${HALT_RULE}. One unit alone may go on.`
}
