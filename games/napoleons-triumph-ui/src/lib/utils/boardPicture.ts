import {
    roundDefinition,
    roundLabel,
    type HydratedNapoleonsTriumphGameState
} from '@tabletop/napoleons-triumph'
import { BOARD_HEIGHT, BOARD_WIDTH } from '$lib/map/boardGeometry.js'
import { viewSize, viewTransformInSvg } from './boardView.js'
import { fileSlug } from '@tabletop/frontend-components'

// The board art is 3400 pixels wide, so the picture is drawn at the art's own size.
const PIXELS_PER_BOARD_UNIT = 3400 / BOARD_WIDTH
const JPEG_QUALITY = 0.92
const FONT_FAMILY = 'Libre Baskerville'

export interface PictureFont {
    url: string
    style: 'normal' | 'italic'
}

/** The layers of the board's drawing that belong in a picture, copied as they stood at one moment. */
export interface PicturedLayers {
    defs: string
    layers: string
}

export interface BoardPictureSource {
    pieces: PicturedLayers
    /** The printed board and anything printed over it, bottom first. */
    artUrls: readonly string[]
    fonts: readonly PictureFont[]
    rotation: number
}

async function fetched(url: string): Promise<Blob> {
    const response = await fetch(url)
    if (!response.ok) {
        throw new Error(`Could not read ${url} for the picture: ${response.status}`)
    }
    return response.blob()
}

function asDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
    })
}

// An image read back out of a canvas must come from the page's own origin, so each is drawn from a copy held by the page.
async function drawable(blob: Blob): Promise<HTMLImageElement> {
    const url = URL.createObjectURL(blob)
    try {
        const image = new Image()
        image.src = url
        await image.decode()
        return image
    } finally {
        URL.revokeObjectURL(url)
    }
}

async function fontFaces(fonts: readonly PictureFont[]): Promise<string> {
    const faces = await Promise.all(
        fonts.map(async ({ url, style }) => {
            const data = await asDataUrl(await fetched(url))
            return `@font-face{font-family:'${FONT_FAMILY}';font-style:${style};font-weight:400 700;src:url(${data}) format('woff2');}`
        })
    )
    return faces.join('')
}

/** Copies the layers the board marks for a picture, at once, so that what is copied is what stands on the board at this instant. */
export function picturedLayers(board: SVGSVGElement): PicturedLayers {
    const copy = (node: Element) => {
        const clone = node.cloneNode(true)
        if (clone instanceof Element) {
            for (const ring of clone.querySelectorAll('.nt-selection-ring')) {
                ring.remove()
            }
        }
        return new XMLSerializer().serializeToString(clone)
    }
    return {
        defs: [...board.querySelectorAll(':scope > defs')].map(copy).join(''),
        layers: [...board.querySelectorAll('[data-in-picture]')].map(copy).join('')
    }
}

// A drawing shown as an image loads nothing from outside itself, so the pieces carry their fonts and their shadow filter with them.
function piecesDrawing(
    { pieces, rotation }: BoardPictureSource,
    faces: string,
    pixels: { width: number; height: number }
): string {
    const view = viewSize(rotation)
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels.width}" height="${pixels.height}" ` +
        `viewBox="0 0 ${view.width} ${view.height}" font-family="'${FONT_FAMILY}', Georgia, serif">` +
        `<style>${faces}</style>${pieces.defs}` +
        `<g transform="${viewTransformInSvg(rotation) ?? ''}">${pieces.layers}</g></svg>`
    )
}

function turned(context: CanvasRenderingContext2D, rotation: number) {
    context.scale(PIXELS_PER_BOARD_UNIT, PIXELS_PER_BOARD_UNIT)
    if (rotation > 0) {
        context.translate(BOARD_HEIGHT, 0)
        context.rotate(Math.PI / 2)
    } else if (rotation < 0) {
        context.translate(0, BOARD_WIDTH)
        context.rotate(-Math.PI / 2)
    }
}

/** The whole board as it is turned, with the pieces as they stand, as a JPEG. */
export async function boardPicture(source: BoardPictureSource): Promise<Blob> {
    const view = viewSize(source.rotation)
    const pixels = {
        width: Math.round(view.width * PIXELS_PER_BOARD_UNIT),
        height: Math.round(view.height * PIXELS_PER_BOARD_UNIT)
    }
    const [art, pieces] = await Promise.all([
        Promise.all(source.artUrls.map(async (url) => drawable(await fetched(url)))),
        fontFaces(source.fonts).then((faces) =>
            drawable(new Blob([piecesDrawing(source, faces, pixels)], { type: 'image/svg+xml' }))
        )
    ])
    const canvas = document.createElement('canvas')
    canvas.width = pixels.width
    canvas.height = pixels.height
    const context = canvas.getContext('2d')
    if (!context) {
        throw new Error('This browser cannot draw the picture')
    }
    context.save()
    turned(context, source.rotation)
    for (const sheet of art) {
        context.drawImage(sheet, 0, 0, BOARD_WIDTH, BOARD_HEIGHT)
    }
    context.restore()
    context.drawImage(pieces, 0, 0, pixels.width, pixels.height)
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error('The picture could not be made'))),
            'image/jpeg',
            JPEG_QUALITY
        )
    })
}

/** A file name saying which game and which moment the picture shows, and whether it tells what the units are. */
export function boardPictureName(
    state: HydratedNapoleonsTriumphGameState,
    showsUnitTypes: boolean
): string {
    const latest = state.rounds.series.at(-1)
    const moment = latest
        ? roundLabel(roundDefinition(state.scenario, latest.number - 1), true)
        : 'set-up'
    const kept = showsUnitTypes ? '' : ' unit types hidden'
    return `${fileSlug(`napoleons triumph ${moment}${kept}`)}.jpg`
}
