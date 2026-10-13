import type { BattleMap, Position } from '@tabletop/napoleons-triumph'

export interface Standing {
    place: string
    stance: string
}

export function standingAt(map: BattleMap, position: Position): Standing {
    return {
        place: map.label(position.locale),
        stance:
            position.approach === undefined
                ? 'in reserve'
                : `facing ${map.label(map.approach(position.approach).neighbour)}`
    }
}
