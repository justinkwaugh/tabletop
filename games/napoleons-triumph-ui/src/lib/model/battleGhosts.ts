import { samePosition, type ProjectedUnit } from '@tabletop/napoleons-triumph'
import { APPROACH_GEOMETRY } from '$lib/map/boardGeometry.js'
import type { Point } from '@tabletop/common'
import type { BlockSprite, BoardPieces, GroupSprite, SingledOut } from '$lib/utils/pieceLayout.js'
import { partStandIns, standInId } from '$lib/utils/standIns.js'
import type { StepLoss } from './attackLosses.js'
import type { LossTaken } from './battleLosses.js'

export interface BattleGhost {
    block: BlockSprite
    loss: StepLoss
}

export interface GhostLink {
    unitId: string
    line: [Point, Point]
}

export function ghostedLosses(
    taken: readonly LossTaken[],
    findUnit: (unitId: string) => ProjectedUnit | undefined
): LossTaken[] {
    return taken.filter(
        ({ unit, loss }) =>
            loss.eliminated || !samePosition(findUnit(unit.id)?.position, unit.position)
    )
}

export function withGhosts(pieces: BoardPieces, ghosted: readonly LossTaken[]): BoardPieces {
    return {
        units: [
            ...pieces.units,
            ...ghosted.map(({ unit }) => ({ ...unit, id: standInId(unit.id) }))
        ],
        commander: (id) => pieces.commander(id)
    }
}

// Deliberate: which of a stack a unit was is its owner's to know. The units that lost steps, and
// their ghosts, stand at the end of their stacks towards the attack, whichever of them they were.
export function lossesSingledOut(
    taken: readonly LossTaken[],
    attackApproach: number | undefined
): SingledOut[] {
    if (taken.length === 0 || attackApproach === undefined) {
        return []
    }
    const unitIds = taken.map(({ unit }) => unit.id)
    return [
        {
            towards: APPROACH_GEOMETRY[attackApproach].centre,
            unitIds: [...unitIds.map(standInId), ...unitIds]
        }
    ]
}

export function partGhosts(
    laidOut: readonly GroupSprite[],
    ghosted: readonly LossTaken[]
): { sprites: GroupSprite[]; ghosts: BattleGhost[] } {
    const { sprites, standIns } = partStandIns(
        laidOut,
        new Map(ghosted.map((taken) => [standInId(taken.unit.id), taken]))
    )
    return {
        sprites,
        ghosts: standIns.map(({ block, of }) => ({
            block: { ...block, unit: of.unit },
            loss: of.loss
        }))
    }
}

export function ghostLinks(
    ghosts: readonly BattleGhost[],
    sprites: readonly GroupSprite[]
): GhostLink[] {
    const standing = new Map(
        sprites.flatMap((sprite) => sprite.blocks).map((block) => [block.unit.id, block])
    )
    return ghosts.flatMap(({ block }) => {
        const now = standing.get(block.unit.id)
        return now ? [{ unitId: block.unit.id, line: [block.centre, now.centre] }] : []
    })
}
