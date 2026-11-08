import { assertExists, type BoundingBox, type Point } from '@tabletop/common'
import cavalierAtlas from '$lib/images/atlas-cavalier.webp'
import cavalierShadows from '$lib/images/shadows-cavalier.webp'
import planAtlas from '$lib/images/atlas-plan.webp'
import frontAtlas from '$lib/images/atlas-front.webp'
import boardLargeCavalier from '$lib/images/board-large-cavalier.webp'
import boardLargeCavalierSideways from '$lib/images/board-large-sideways-cavalier.webp'
import boardSmallCavalier from '$lib/images/board-small-cavalier.webp'
import boardSmallCavalierSideways from '$lib/images/board-small-sideways-cavalier.webp'
import boardLargePlan from '$lib/images/board-large-plan.webp'
import boardLargePlanSideways from '$lib/images/board-large-sideways-plan.webp'
import boardSmallPlan from '$lib/images/board-small-plan.webp'
import boardSmallPlanSideways from '$lib/images/board-small-sideways-plan.webp'
import {
    BOARD_FRAMES,
    SHEET_LAYOUTS,
    VIEW_AXES,
    type BoardFrame,
    type BoardView,
    type SheetName,
    type SpriteFrame
} from './atlas.generated.js'

export type { BoardFrame, BoardView, SheetName, SpriteFrame }
export { VIEW_AXES }

const SHEET_URLS: Record<SheetName, string> = {
    cavalier: cavalierAtlas,
    'cavalier-shadows': cavalierShadows,
    plan: planAtlas,
    front: frontAtlas
}

export function sheetUrl(sheet: SheetName): string {
    return SHEET_URLS[sheet]
}

export function sheetSize(sheet: SheetName): { width: number; height: number } {
    const { width, height } = SHEET_LAYOUTS[sheet]
    return { width, height }
}

export function hasSprite(sheet: SheetName, name: string): boolean {
    return name in SHEET_LAYOUTS[sheet].frames
}

export function spriteFrame(sheet: SheetName, name: string): SpriteFrame {
    const frame = SHEET_LAYOUTS[sheet].frames[name]
    assertExists(frame, `No sprite ${name} on the ${sheet} sheet`)
    return frame
}

// Where a sprite's frame lands on the board. A nested svg showing one frame reports the whole
// sheet as its bounding box, so anything sized from the box (filters) must use this instead.
export function spriteBox(
    sheet: SheetName,
    name: string,
    anchor: Point,
    unitsPerCell: number
): BoundingBox {
    const frame = spriteFrame(sheet, name)
    return {
        x: anchor.x + frame.x * unitsPerCell,
        y: anchor.y + frame.y * unitsPerCell,
        width: frame.w * unitsPerCell,
        height: frame.h * unitsPerCell
    }
}

const BOARD_URLS: Record<string, string> = {
    'cavalier/board-large': boardLargeCavalier,
    'cavalier/board-large-sideways': boardLargeCavalierSideways,
    'cavalier/board-small': boardSmallCavalier,
    'cavalier/board-small-sideways': boardSmallCavalierSideways,
    'plan/board-large': boardLargePlan,
    'plan/board-large-sideways': boardLargePlanSideways,
    'plan/board-small': boardSmallPlan,
    'plan/board-small-sideways': boardSmallPlanSideways
}

export type BoardArt = BoardFrame & { url: string }

export function boardArt(view: BoardView, small: boolean, sideways: boolean): BoardArt {
    const name = `board-${small ? 'small' : 'large'}${sideways ? '-sideways' : ''}`
    const frame = BOARD_FRAMES[view][name]
    assertExists(frame, `No ${name} board for the ${view} view`)
    return { ...frame, url: BOARD_URLS[`${view}/${name}`] }
}
