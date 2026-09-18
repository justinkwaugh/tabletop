import { assertExists } from '@tabletop/common'
import { type TileFace, type TileRotation, type TileSet } from '@tabletop/18xx'
import { TheOldPrinceTileSet, TheOldPrincePreprintedTiles } from '@tabletop/the-old-prince'
import { Shikoku1889TileSet, Shikoku1889PreprintedTiles } from '@tabletop/shikoku-1889'

export const PreprintedTileExamples = [
    ...['K19', 'O15', 'I17'].map((locationId) => ({
        title: 'TOP',
        locationId,
        face: TheOldPrincePreprintedTiles[locationId]
    })),
    ...['I2', 'I4', 'K4', 'F9'].map((locationId) => ({
        title: '1889',
        locationId,
        face: Shikoku1889PreprintedTiles[locationId]
    }))
]

export const TileReplacementExamples = [
    replacementExample(
        'TOP · K19',
        TheOldPrinceTileSet,
        'K19',
        TheOldPrincePreprintedTiles.K19,
        'the-old-prince:PEI1'
    ),
    replacementExample(
        '1889 · I2',
        Shikoku1889TileSet,
        'I2',
        Shikoku1889PreprintedTiles.I2,
        '18xx:14'
    )
]

function replacementExample(
    title: string,
    set: TileSet,
    locationId: string,
    preprintedTile: TileFace,
    upgradeId: string
) {
    const initial = set.createInventory()
    const firstId = '18xx:5'
    const firstPiece = set.availablePieces(initial, firstId)[0]
    const laid = set.replace(initial, {
        locationId,
        placement: { pieceId: firstPiece.id, definitionId: firstId, rotation: 0 },
        returnPrevious: true
    })
    const nextPiece = set.availablePieces(laid, upgradeId)[0]
    const replaced = set.replace(laid, {
        locationId,
        placement: { pieceId: nextPiece.id, definitionId: upgradeId, rotation: 0 },
        returnPrevious: true
    })
    const first = set.definitions.find((definition) => definition.id === firstId)
    const upgrade = set.definitions.find((definition) => definition.id === upgradeId)
    assertExists(first, 'Placement example requires its yellow tile')
    assertExists(upgrade, 'Placement example requires its green tile')
    const stages: readonly { caption: string; face: TileFace; rotation: TileRotation }[] = [
        { caption: 'Preprinted tile', face: preprintedTile, rotation: 0 },
        {
            caption: `${first.printedNumber} placed · ${set.availablePieces(laid, firstId).length} left`,
            face: first.face,
            rotation: laid.placements[locationId].rotation
        },
        {
            caption: `${upgrade.printedNumber} placed · ${first.printedNumber} returned (${set.availablePieces(replaced, firstId).length} available)`,
            face: upgrade.face,
            rotation: replaced.placements[locationId].rotation
        }
    ]
    return { title, stages }
}
