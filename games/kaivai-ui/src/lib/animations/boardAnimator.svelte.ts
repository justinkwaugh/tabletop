import {
    assertExists,
    coordinatesToNumber,
    sameCoordinates,
    type AxialCoordinates,
    type Point
} from '@tabletop/common'
import { AnimationContext } from '@tabletop/frontend-components'
import {
    isBoatCell,
    isIslandCell,
    type HydratedKaivaiGameState,
    type KaivaiGameBoard,
    type WaterCell
} from '@tabletop/kaivai'
import { gsap } from 'gsap'
import { tick } from 'svelte'
import type { KaivaiGameSession } from '../model/KaivaiGameSession.svelte.js'

type BoatPlacement = NonNullable<WaterCell['boat']> & {
    coords: AxialCoordinates
}

export class BoardAnimator {
    private elements = new Map<string, SVGGraphicsElement>()
    private boardSpace?: SVGGraphicsElement
    private tileElements = new Map<number, SVGElement>()
    private timelines = new Set<gsap.core.Timeline>()
    private previewTimeline?: gsap.core.Timeline
    private previewGeneration = 0
    private disposed = false
    private movingIds = $state.raw(new Set<string>())
    private animatedPlacements: BoatPlacement[] | undefined = $derived.by(() => {
        this.session.gameState
        return undefined
    })
    private animatedCells: KaivaiGameBoard['cells'] | undefined = $derived.by(() => {
        this.session.gameState
        return undefined
    })
    private godCoords = $derived.by(() => this.session.gameState.godLocation?.coords)
    private livePlacements = $derived.by(() => {
        const placements = this.placementsInState(this.session.gameState)
        const boatId = this.session.chosenBoat
        const destination = this.session.chosenBoatLocation
        if (!boatId || !destination) return placements
        const chosenBoat = placements.find((boat) => boat.id === boatId)
        assertExists(chosenBoat, 'The selected boat must be on the board')
        if (placements.some((boat) => sameCoordinates(boat.coords, destination))) return placements
        return placements.map((boat) =>
            boat.id === boatId ? { ...boat, coords: destination } : boat
        )
    })

    constructor(private readonly session: KaivaiGameSession) {}

    boatsAt(coords: AxialCoordinates): BoatPlacement[] {
        return (this.animatedPlacements ?? this.livePlacements).filter((boat) =>
            sameCoordinates(boat.coords, coords)
        )
    }

    isAboveMask(id: string): boolean {
        return this.movingIds.has(id) || this.session.chosenBoat === id
    }

    get raisedCoordinates(): AxialCoordinates[] {
        const coords = (this.animatedPlacements ?? this.livePlacements)
            .filter((boat) => this.isAboveMask(boat.id))
            .map((boat) => boat.coords)
        if (this.movingIds.has('god') && this.godCoords) coords.push(this.godCoords)
        return [...new Map(coords.map((point) => [coordinatesToNumber(point), point])).values()]
    }

    cellAt(coords: AxialCoordinates) {
        return (this.animatedCells ?? this.session.gameState.board.cells)[
            coordinatesToNumber(coords)
        ]
    }

    hasGodAt(coords: AxialCoordinates): boolean {
        return sameCoordinates(this.godCoords, coords)
    }

    attachBoat(node: SVGGraphicsElement, id: string) {
        return this.attachElement(this.elements, node, id)
    }

    attachTile(node: SVGElement, coords: AxialCoordinates) {
        return this.attachElement(this.tileElements, node, coordinatesToNumber(coords))
    }

    attachGod(node: SVGGraphicsElement) {
        return this.attachElement(this.elements, node, 'god')
    }

    attachBoard(node: SVGGraphicsElement) {
        this.boardSpace = node
        return {
            destroy: () => {
                if (this.boardSpace === node) this.boardSpace = undefined
            }
        }
    }

    async preview(updateDraft: () => void) {
        const snapshot = this.capturePositions()
        const generation = this.previewGeneration
        const boatId = this.session.chosenBoat
        updateDraft()
        this.movingIds = new Set(boatId ? [boatId] : [])
        await tick()
        if (this.disposed || generation !== this.previewGeneration) return
        this.previewTimeline = this.moveFrom(snapshot, true)
        this.previewTimeline.eventCallback('onComplete', () => {
            if (generation === this.previewGeneration && !this.disposed) {
                this.movingIds = new Set()
                this.previewTimeline = undefined
            }
        })
        this.previewTimeline.play()
    }

    async animate(
        from: HydratedKaivaiGameState,
        to: HydratedKaivaiGameState,
        animationContext: AnimationContext
    ) {
        const previous = this.animatedPlacements ?? this.livePlacements
        const toPlacements = this.placementsInState(to)
        const previousById = new Map(previous.map((boat) => [boat.id, boat]))
        const fromById = new Map(this.placementsInState(from).map((boat) => [boat.id, boat]))
        const movingIds = toPlacements
            .filter((boat) => {
                const prior = previousById.get(boat.id)
                const fromBoat = fromById.get(boat.id)
                return (
                    prior &&
                    (!sameCoordinates(prior.coords, boat.coords) ||
                        this.movingIds.has(boat.id) ||
                        (fromBoat && !sameCoordinates(fromBoat.coords, boat.coords)))
                )
            })
            .map((boat) => boat.id)
        const fromGod = from.godLocation?.coords
        const toGod = to.godLocation?.coords
        if (fromGod && toGod && !sameCoordinates(fromGod, toGod)) movingIds.push('god')
        const snapshot = this.capturePositions(movingIds)
        this.movingIds = new Set(movingIds)
        const targetIds = new Set(toPlacements.map((boat) => boat.id))
        const departing = previous.filter((boat) => !targetIds.has(boat.id))
        const previousIds = new Set(previous.map((boat) => boat.id))
        const previousTiles = this.tilesInCells(
            this.animatedCells ?? this.session.gameState.board.cells
        )
        const toTiles = this.tilesInCells(to.board.cells)
        const departingTiles = [...previousTiles].filter(([id]) => !toTiles.has(id))
        this.animatedPlacements = [...toPlacements, ...departing]
        this.animatedCells = { ...to.board.cells, ...Object.fromEntries(departingTiles) }
        this.godCoords = toGod ?? fromGod
        await tick()
        if (this.disposed) return
        const movement = this.moveFrom(snapshot, true)
        const timeline = gsap.timeline({ paused: true })
        timeline.add(movement, 0)
        movement.paused(false)
        this.timelines.add(timeline)
        for (const boat of toPlacements) {
            if (previousIds.has(boat.id)) continue
            const node = this.elements.get(boat.id)
            if (node) this.fadeScale(timeline, node, true)
        }
        for (const boat of departing) {
            const node = this.elements.get(boat.id)
            if (node) this.fadeScale(timeline, node, false)
        }
        for (const id of toTiles.keys()) {
            if (previousTiles.has(id)) continue
            const node = this.tileElements.get(id)
            if (node) this.fadeScale(timeline, node, true)
        }
        for (const [id] of departingTiles) {
            const node = this.tileElements.get(id)
            if (node) this.fadeScale(timeline, node, false)
        }
        const god = this.elements.get('god')
        if (god && Boolean(fromGod) !== Boolean(toGod))
            this.fadeScale(timeline, god, Boolean(toGod))
        animationContext.actionTimeline.add(timeline, 0)
        timeline.paused(false)
        animationContext.afterAnimations(() => {
            this.timelines.delete(timeline)
            if (!this.disposed) {
                this.movingIds = new Set()
                this.animatedPlacements = toPlacements
                this.animatedCells = to.board.cells
                this.godCoords = toGod
            }
        })
    }

    beforeStateSwap() {
        this.cancelPreview()
        this.movingIds = new Set()
    }

    dispose() {
        this.disposed = true
        this.cancelPreview()
        for (const timeline of this.timelines) {
            timeline.progress(1)
            timeline.kill()
        }
        this.timelines.clear()
        for (const node of this.elements.values()) gsap.killTweensOf(node)
        for (const node of this.tileElements.values()) gsap.killTweensOf(node)
        this.elements.clear()
        this.tileElements.clear()
        this.boardSpace = undefined
    }

    private capturePositions(ids = [...this.elements.keys()]): Map<string, Point> {
        this.cancelPreview()
        const positions = new Map<string, Point>()
        if (ids.length === 0) return positions
        const boardMatrix = this.boardSpace?.getCTM()
        assertExists(boardMatrix, 'Expected a mounted board coordinate space')
        const inverse = boardMatrix.inverse()
        for (const id of ids) {
            const node = this.elements.get(id)
            if (!node) continue
            const matrix = node.getCTM()
            assertExists(matrix, 'Expected a mounted piece transform')
            const point = new DOMPoint().matrixTransform(inverse.multiply(matrix))
            positions.set(id, { x: point.x, y: point.y })
        }
        return positions
    }

    private moveFrom(snapshot: Map<string, Point>, paused = false): gsap.core.Timeline {
        const timeline = gsap.timeline({ paused })
        if (snapshot.size === 0) return timeline
        const boardMatrix = this.boardSpace?.getCTM()
        assertExists(boardMatrix, 'Expected a mounted board coordinate space')
        for (const [id, point] of snapshot) {
            const node = this.elements.get(id)
            if (!node) continue
            gsap.set(node, { clearProps: 'transform' })
            const matrix = node.getCTM()
            assertExists(matrix, 'Expected a mounted piece transform')
            const start = new DOMPoint(point.x, point.y).matrixTransform(
                matrix.inverse().multiply(boardMatrix)
            )
            if (Math.abs(start.x) < 0.001 && Math.abs(start.y) < 0.001) continue
            timeline.fromTo(node, { x: start.x, y: start.y }, { x: 0, y: 0, duration: 0.2 }, 0)
        }
        return timeline
    }

    private tilesInCells(cells: KaivaiGameBoard['cells']) {
        return new Map(
            Object.values(cells)
                .filter(isIslandCell)
                .map((cell) => [coordinatesToNumber(cell.coords), cell])
        )
    }

    private fadeScale(timeline: gsap.core.Timeline, node: SVGElement, entering: boolean) {
        if (entering) {
            timeline.fromTo(
                node,
                { opacity: 0, scale: 0.1, svgOrigin: '0 0' },
                { opacity: 1, scale: 1, duration: 0.1 },
                0
            )
        } else {
            timeline.to(node, { opacity: 0, scale: 0.1, svgOrigin: '0 0', duration: 0.1 }, 0)
        }
    }

    private attachElement<TKey, TElement extends SVGElement>(
        elements: Map<TKey, TElement>,
        node: TElement,
        id: TKey
    ) {
        elements.set(id, node)
        return {
            destroy: () => {
                gsap.killTweensOf(node)
                if (elements.get(id) === node) elements.delete(id)
            }
        }
    }

    private cancelPreview() {
        this.previewGeneration += 1
        this.previewTimeline?.kill()
        this.previewTimeline = undefined
    }

    private placementsInState(state: HydratedKaivaiGameState): BoatPlacement[] {
        return Object.values(state.board.cells).flatMap((cell) =>
            isBoatCell(cell) && cell.boat ? [{ ...cell.boat, coords: cell.coords }] : []
        )
    }
}
