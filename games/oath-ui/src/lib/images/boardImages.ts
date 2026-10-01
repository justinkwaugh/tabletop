import { assertExists, type Color } from '@tabletop/common'
import { PlayerStatus } from '@tabletop/oath'
import { playerBoardFiles } from './imageManifest.generated.js'
import { imageNamed, indexByName } from './manifestIndex.js'

// Keyed by `PlayerStatus` and, for Exiles and Citizens, colour; every Citizen board prints the same title.
const byName = indexByName(playerBoardFiles)

export function boardKey(status: PlayerStatus, color: Color | undefined): string {
    return status === PlayerStatus.Chancellor ? 'chancellor' : `${status}.${color ?? ''}`
}

export function titleImage(status: PlayerStatus, color: Color | undefined): string {
    const key = status === PlayerStatus.Citizen ? PlayerStatus.Citizen : boardKey(status, color)
    return imageNamed(byName, `title.${key}`)
}

export function avatarImage(status: PlayerStatus, color: Color | undefined): string {
    return imageNamed(byName, `avatar.${boardKey(status, color)}`)
}

// Sampled from each board's top-left corner; Citizen boards are Imperial
// purple with the seat colour as a flash.
const GROUNDS: Readonly<Record<string, string>> = {
    chancellor: '#856283',
    'citizen.black': '#856283',
    'citizen.blue': '#856283',
    'citizen.red': '#856283',
    'citizen.white': '#856283',
    'citizen.yellow': '#856283',
    'exile.black': '#596979',
    'exile.blue': '#5d99bd',
    'exile.red': '#de584c',
    'exile.white': '#e5d7ce',
    'exile.yellow': '#f3c96f'
}

export function boardGround(status: PlayerStatus, color: Color | undefined): string {
    const key = boardKey(status, color)
    const ground = GROUNDS[key]
    assertExists(ground, `No board is printed for ${key}`)
    return ground
}

export function boardImageKeys(): string[] {
    return [...byName.keys()]
}
