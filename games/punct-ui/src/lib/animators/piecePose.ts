import type { Attachment } from 'svelte/attachments'
import type { PieceKind } from '@tabletop/punct'
import type { BoardView } from '$lib/board/geometry.js'
import {
    dotsOnScreen,
    drawPiece,
    pathOf,
    silhouetteOf,
    type PieceDrawing,
    type Tone
} from '$lib/board/pieceShape.js'
import { bodyImage, dishBox } from '$lib/board/looks.js'
import { speckPaths } from '$lib/board/specks.js'
import { shadowOpacity, shadowPath } from '$lib/board/drawing.js'

// Where a moving piece is: its PÜNCT on the unturned board's plane, the heights of its underside
// and of the surface its shadow falls on, its rotation, and how solid it is.
export type PieceAt = {
    x: number
    y: number
    base: number
    ground: number
    angle: number
    opacity: number
}

type Drawing = {
    view: BoardView
    shadow: SVGPathElement
    piece: SVGGElement
    body: LiveBody
    onPiece?: boolean
}

function partsOf<T extends Element>(root: Element, name: string, type: new () => T): T[] {
    return [...root.querySelectorAll(`[data-part="${name}"]`)].map((node) => {
        if (!(node instanceof type)) throw Error(`The ${name} part is a ${type.name}`)
        return node
    })
}

function partOf<T extends Element>(root: Element, name: string, type: new () => T): T {
    const [node] = partsOf(root, name, type)
    if (node === undefined) throw Error(`A moving piece draws its ${name}`)
    return node
}

// A piece in motion, drawn by writing its nodes as GSAP sets its pose: no reactive state changes
// at each frame, and every move is translate() (GSAP writes SVG motion as matrix(), which Firefox
// 140 misplaces under the board's zoom). While it turns, its body is drawn live.
export class PiecePose implements PieceAt {
    private readonly at: PieceAt
    private drawing: Drawing | undefined
    private readonly rings = new Map<SVGGElement, BoardView>()

    constructor(
        readonly kind: PieceKind,
        readonly seed: number,
        at: PieceAt
    ) {
        this.at = { ...at }
    }

    get x() {
        return this.at.x
    }
    set x(x: number) {
        this.set({ x })
    }
    get y() {
        return this.at.y
    }
    set y(y: number) {
        this.set({ y })
    }
    get base() {
        return this.at.base
    }
    set base(base: number) {
        this.set({ base })
    }
    get ground() {
        return this.at.ground
    }
    set ground(ground: number) {
        this.set({ ground })
    }
    get angle() {
        return this.at.angle
    }
    set angle(angle: number) {
        this.set({ angle })
    }
    get opacity() {
        return this.at.opacity
    }
    set opacity(opacity: number) {
        this.set({ opacity })
    }

    get current(): PieceAt {
        return { ...this.at }
    }

    set(change: Partial<PieceAt>) {
        const turned = change.angle !== undefined && change.angle !== this.at.angle
        Object.assign(this.at, change)
        this.write(turned)
    }

    // Its shadow and the piece, in the view they are drawn in: a new view draws them afresh.
    drawn(view: BoardView, tone: Tone, prefix: string): Attachment<SVGGElement> {
        return (node) => {
            const piece = partOf(node, 'piece', SVGGElement)
            this.drawing = {
                view,
                shadow: partOf(node, 'shadow', SVGPathElement),
                piece,
                body: new LiveBody(
                    partOf(node, 'body', SVGGElement),
                    partOf(node, 'hit', SVGPathElement),
                    this.kind,
                    tone,
                    this.seed,
                    prefix
                )
            }
            this.write(true)
            return () => {
                if (this.drawing?.piece === piece) this.drawing = undefined
            }
        }
    }

    // The ring round its top that marks it as yours to turn.
    ring(view: BoardView): Attachment<SVGGElement> {
        return (node) => {
            this.rings.set(node, view)
            this.drawRing(node, view)
            return () => {
                this.rings.delete(node)
            }
        }
    }

    private write(turned: boolean) {
        if (turned) for (const [node, view] of this.rings) this.drawRing(node, view)
        const drawing = this.drawing
        if (drawing === undefined) return
        const { view, piece, shadow } = drawing
        const { x, y, base, ground, opacity } = this.at
        const plan = view.orient({ x, y })
        const top = view.project(plan, base)
        const under = view.project(plan, ground)
        piece.setAttribute('transform', `translate(${top.x} ${top.y})`)
        this.setOpacity(piece, opacity)
        shadow.setAttribute('transform', `translate(${under.x} ${under.y})`)
        this.setOpacity(shadow, shadowOpacity(base, ground) * opacity)
        const onPiece = ground > 0
        const angle = this.screenAngle(view)
        if (turned || onPiece !== drawing.onPiece) {
            drawing.onPiece = onPiece
            shadow.setAttribute('d', shadowPath(this.kind, angle, onPiece, view))
            shadow.classList.toggle('crease', onPiece)
        }
        if (turned) drawing.body.draw(angle, view)
    }

    private setOpacity(node: SVGElement, opacity: number) {
        if (opacity < 1) node.setAttribute('opacity', String(opacity))
        else node.removeAttribute('opacity')
    }

    private drawRing(node: SVGGElement, view: BoardView) {
        const outline = pathOf(drawPiece(this.kind, this.screenAngle(view), view).topOutline)
        for (const path of partsOf(node, 'ring', SVGPathElement)) path.setAttribute('d', outline)
    }

    private screenAngle(view: BoardView): number {
        return this.at.angle + view.turnSteps
    }
}

// A piece's body, dots and specks round its PÜNCT. Where it lies a way an image is drawn for, its
// body is the image, with the live drawing kept under it until the image has loaded, so the body
// never vanishes for a frame as it comes to rest.
class LiveBody {
    private readonly image: SVGImageElement
    private readonly live: SVGGElement
    private readonly slices: SVGPathElement[]
    private readonly top: SVGPathElement
    private readonly specks: Record<'side' | 'sideGrey' | 'top' | 'topGrey', SVGPathElement>
    private readonly dishes: SVGImageElement[]
    private readonly dish = dishBox()
    private shownHref: string | undefined
    private loadedHref: string | undefined

    constructor(
        root: SVGGElement,
        private readonly hit: SVGPathElement,
        private readonly kind: PieceKind,
        private readonly tone: Tone,
        private readonly seed: number,
        private readonly prefix: string
    ) {
        this.image = partOf(root, 'image', SVGImageElement)
        this.live = partOf(root, 'live', SVGGElement)
        this.slices = partsOf(root, 'slice', SVGPathElement)
        this.top = partOf(root, 'top', SVGPathElement)
        this.specks = {
            side: partOf(root, 'side-specks', SVGPathElement),
            sideGrey: partOf(root, 'side-specks-grey', SVGPathElement),
            top: partOf(root, 'top-specks', SVGPathElement),
            topGrey: partOf(root, 'top-specks-grey', SVGPathElement)
        }
        this.dishes = partsOf(root, 'dish', SVGImageElement)
        this.image.addEventListener('load', () => {
            this.loadedHref = this.image.href.baseVal
            if (this.loadedHref === this.shownHref) this.live.style.display = 'none'
        })
    }

    draw(angle: number, view: BoardView) {
        const image = bodyImage(this.kind, angle, this.tone)
        this.shownHref = image?.href
        if (image) {
            this.image.setAttribute('href', image.href)
            this.image.setAttribute('x', String(image.x))
            this.image.setAttribute('y', String(image.y))
            this.image.setAttribute('width', String(image.width))
            this.image.setAttribute('height', String(image.height))
            this.image.style.display = ''
        } else {
            this.image.style.display = 'none'
        }
        const drawing = drawPiece(this.kind, angle, view)
        this.hit.setAttribute('d', silhouetteOf(drawing))
        const live = image === undefined || image.href !== this.loadedHref
        this.live.style.display = live ? '' : 'none'
        if (live) this.drawLive(drawing)
        const specks = speckPaths(this.kind, this.seed, angle, view)
        for (const name of ['side', 'sideGrey', 'top', 'topGrey'] as const) {
            this.specks[name].setAttribute('d', specks[name])
        }
        dotsOnScreen(this.kind, angle, view).forEach((dot, index) => {
            this.dishes[index].setAttribute('x', String(dot.x + this.dish.x))
            this.dishes[index].setAttribute('y', String(dot.y + this.dish.y))
        })
    }

    private drawLive(drawing: PieceDrawing) {
        drawing.slices.forEach((slice, index) => {
            this.slices[index].setAttribute('d', pathOf(slice.points))
            this.slices[index].setAttribute(
                'fill',
                `url(#${this.prefix}-${this.tone}-${slice.shade})`
            )
        })
        this.top.setAttribute('d', pathOf(drawing.top))
    }
}

// A value GSAP tweens from 0 to 1, which places a piece along its way as it is set: a setter, not
// onUpdate, so a timeline jumped to its end still leaves the piece there.
export function progressPath(place: (t: number) => void): { t: number } {
    let progress = 0
    return {
        get t() {
            return progress
        },
        set t(t: number) {
            progress = t
            place(t)
        }
    }
}
