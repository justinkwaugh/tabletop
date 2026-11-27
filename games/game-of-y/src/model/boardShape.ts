// The board a game is played on: Kadon's curved board of 93 points, or a triangle of hexagons.
// Kept apart from the boards' grids, as the game's config, which the site loads with every page,
// names it.
export enum BoardShape {
    Kadon = 'Kadon',
    Hex9 = 'Hex9',
    Hex13 = 'Hex13',
    Hex19 = 'Hex19'
}
