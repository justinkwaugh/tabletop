import { Type, type Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { Hydratable, OffsetCoordinates } from '@tabletop/common'
import { Cube } from './cube.js'
import { Roof } from './roof.js'
import { Barrier, BarrierDirection } from './barrier.js'

export type Site = Static<typeof Site>
export const Site = Type.Object({
    single: Type.Boolean(),
    cubes: Type.Array(Cube),
    roof: Type.Optional(Roof),
    barriers: Type.Array(Barrier)
})

export type BoardRow = Static<typeof BoardRow>
export const BoardRow = Type.Object({
    mayor: Type.Boolean(),
    sites: Type.Array(Site),
    length: Type.Number()
})

export type EstatesGameBoard = Static<typeof EstatesGameBoard>
export const EstatesGameBoard = Type.Object({
    rows: Type.Array(BoardRow)
})

export const EstatesGameBoardValidator = TypeCompiler.Compile(EstatesGameBoard)

export class HydratedEstatesGameBoard
    extends Hydratable<typeof EstatesGameBoard>
    implements EstatesGameBoard
{
    declare rows: BoardRow[]

    constructor(data: EstatesGameBoard) {
        super(data, EstatesGameBoardValidator)
    }

    canPlaceCubeAtCoords(cube: Cube, coords: OffsetCoordinates): boolean {
        const site = this.getSiteAtCoords(coords)
        if (!site) {
            return false
        }

        const boardRow = this.rows[coords.row]
        if (coords.col >= boardRow.length) {
            return false
        }

        const emptySiteIndex = boardRow.sites.findIndex((site) => site.cubes.length === 0)
        if (coords.col > emptySiteIndex) {
            return false
        }

        return this.canPlaceCubeAtSite(cube, site)
    }

    canPlaceCubeAtSite(cube: Cube, site: Site): boolean {
        if (site.roof) {
            return false
        }

        if (site.single && site.cubes.length > 0) {
            return false
        }

        return site.cubes.length === 0 || site.cubes[site.cubes.length - 1].value > cube.value
    }

    placeCubeAtSite(cube: Cube, coords: OffsetCoordinates) {
        const boardRow = this.rows[coords.row]
        const site = boardRow.sites[coords.col]
        site.cubes.push(cube)
    }

    canPlaceRoofAtSite(coords: OffsetCoordinates): boolean {
        const site = this.getSiteAtCoords(coords)
        if (!site) {
            return false
        }
        return site.cubes.length > 0 && !site.roof
    }

    placeRoofAtSite(roof: Roof, coords: OffsetCoordinates) {
        const boardRow = this.rows[coords.row]
        const site = boardRow.sites[coords.col]
        site.roof = roof
    }

    placeMayorAtRow(row: number) {
        const boardRow = this.rows[row]
        boardRow.mayor = true
    }

    canPlaceBarrierAtSite(barrier: Barrier, coords: OffsetCoordinates): boolean {
        const site = this.getSiteAtCoords(coords)
        if (!site) {
            return false
        }

        if (site.cubes.length > 0) {
            return false
        }

        const boardRow = this.rows[coords.row]

        const positiveBarrierIndex = boardRow.length + barrier.value
        const negativeBarrierIndex = boardRow.length - barrier.value

        if (coords.col !== positiveBarrierIndex && coords.col !== negativeBarrierIndex) {
            console.log('h')
            return false
        }

        return true
    }

    placeBarrierAtSite(barrier: Barrier, coords: OffsetCoordinates) {
        const boardRow = this.rows[coords.row]
        const chosenSite = boardRow.sites[coords.col]

        barrier.direction =
            coords.col > boardRow.length ? BarrierDirection.Lengthen : BarrierDirection.Shorten

        const movedBarriers = []
        for (const site of boardRow.sites) {
            if (site.barriers.length > 0) {
                movedBarriers.push(...site.barriers)
                site.barriers = []
            }
        }
        chosenSite.barriers.push(...movedBarriers)
        chosenSite.barriers.push(barrier)
        boardRow.length = coords.col
    }

    validRoofLocations(): OffsetCoordinates[] {
        const validLocations: OffsetCoordinates[] = []
        for (let row = 0; row < this.rows.length; row++) {
            const boardRow = this.rows[row]
            for (let col = 0; col < boardRow.sites.length; col++) {
                if (this.canPlaceRoofAtSite({ row, col })) {
                    validLocations.push({ row, col })
                }
            }
        }
        return validLocations
    }

    validCubeLocations(cube?: Cube | null): OffsetCoordinates[] {
        if (!cube) {
            return []
        }
        const validLocations: OffsetCoordinates[] = []
        for (let row = 0; row < this.rows.length; row++) {
            const boardRow = this.rows[row]
            for (let col = 0; col < boardRow.sites.length; col++) {
                if (this.canPlaceCubeAtCoords(cube, { row, col })) {
                    validLocations.push({ row, col })
                }
            }
        }
        return validLocations
    }

    getSiteAtCoords(coords: OffsetCoordinates): Site | undefined {
        if (coords.row < 0 || coords.row >= this.rows.length) {
            return undefined
        }

        const boardRow = this.rows[coords.row]
        if (coords.col < 0 || coords.col >= boardRow.sites.length) {
            return undefined
        }

        return boardRow.sites[coords.col]
    }
}
