import { createRectangularStockMarket } from '@tabletop/18xx'

export function createTheOldPrinceStockMarket() {
    const market = createRectangularStockMarket(
        [
            [null, null, 111, 122, 136, 152, 170, 190, 215, 240, 270, 300, 330, 360, 400],
            [88, 92, 100, 110, 121, 133, 146, 160, 180, 200, 225, 250, 280],
            [82, 86, 93, 101, 111, 123, 137, 152, 167, 185, 203],
            [78, 80, 86, 94, 102, 112, 122],
            [71, 74, 79, 84, 89, 94],
            [60, 65, 69, 73, 78],
            [55, 58, 61, 65]
        ],
        (row, column) => {
            if (row === 0 && column === 14) return 'orange'
            if (column !== 1) return 'white'
            return row === 3
                ? 'yellow'
                : row === 4
                  ? 'green'
                  : row === 5
                    ? 'blue'
                    : row === 6
                      ? 'red'
                      : 'white'
        }
    )
    return market
}
