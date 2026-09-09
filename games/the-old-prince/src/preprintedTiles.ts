import { createCityTileFace, parseTileFace, type TileFace } from '@tabletop/18xx'

export const TheOldPrincePreprintedTiles: Readonly<Record<string, TileFace>> = Object.freeze({
    K19: parseTileFace(createCityTileFace('white', [], 0, 1)),
    O15: parseTileFace(createCityTileFace('yellow', [0, 2, 4], 30, 1)),
    I17: parseTileFace(createCityTileFace('gray', [0, 2, 4], 10, 2))
})
