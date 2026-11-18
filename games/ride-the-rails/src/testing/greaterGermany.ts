import { boardMap } from '../data/boardMaps.js'
import type { HexId } from '../data/hexes.js'
import type { Track } from '../model/gameState.js'
import { addTrack, shortestPath, type OneShort } from './intercolonial.js'

export const BERLIN: HexId = 'hex.de.19-17'
export const HAMBURG: HexId = 'hex.de.10-8'
export const KOLN: HexId = 'hex.de.2-30'
export const DRESDEN: HexId = 'hex.de.21-29'
export const MUNCHEN: HexId = 'hex.de.15-51'

// R-8.5: Germany's track one placement short of Greater Germany. Blue runs from Hamburg to Berlin,
// Red from Hamburg to Köln, Orange from Berlin to Dresden and Yellow from Dresden toward München,
// so the network changes railroad only in those cities. Yellow's locomotive in München joins the
// five.
export function greaterGermanyOneShort(): OneShort {
    const map = boardMap('map.de')
    const track: Track = {}
    addTrack(track, 'railroad.blue', shortestPath(map, HAMBURG, BERLIN))
    addTrack(track, 'railroad.red', shortestPath(map, HAMBURG, KOLN))
    addTrack(track, 'railroad.orange', shortestPath(map, BERLIN, DRESDEN))
    addTrack(track, 'railroad.yellow', shortestPath(map, DRESDEN, MUNCHEN).slice(0, -1))
    return { track, railroadId: 'railroad.yellow', hexId: MUNCHEN }
}
