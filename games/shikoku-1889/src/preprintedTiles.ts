import { createCityTileFace, parseTileFace, type TileFace } from '@tabletop/18xx'

export const Shikoku1889PreprintedTiles: Readonly<Record<string, TileFace>> = Object.freeze({
    I2: parseTileFace(createCityTileFace('white', [], 0, 1)),
    I4: parseTileFace(createCityTileFace('white', [], 0, 1, ['H'])),
    K4: parseTileFace(createCityTileFace('yellow', [0, 1, 2], 30, 1, ['T'])),
    F9: parseTileFace(createCityTileFace('green', [2, 3, 4, 5], 30, 2, ['K']))
})
