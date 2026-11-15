import type { BlockSprite, GroupSprite } from './pieceLayout.js'

export interface StandIn<T> {
    block: BlockSprite
    of: T
}

// Deliberate: stand-ins are laid out as pieces of their own beside those that stand, so a stack
// some units left keeps the shape it had and the stand-ins are not hidden under it.
export function standInId(unitId: string): string {
    return `${unitId} (stand-in)`
}

export function partStandIns<T>(
    laidOut: readonly GroupSprite[],
    standIns: ReadonlyMap<string, T>
): { sprites: GroupSprite[]; standIns: StandIn<T>[] } {
    const parted = laidOut.flatMap((sprite) =>
        sprite.blocks.flatMap((block) => {
            const of = standIns.get(block.unit.id)
            return of === undefined ? [] : [{ block, of }]
        })
    )
    const sprites = laidOut.flatMap((sprite) => {
        const blocks = sprite.blocks.filter((block) => !standIns.has(block.unit.id))
        const units = sprite.group.units.filter((unit) => !standIns.has(unit.id))
        return blocks.length > 0 ? [{ ...sprite, blocks, group: { ...sprite.group, units } }] : []
    })
    return { sprites, standIns: parted }
}
