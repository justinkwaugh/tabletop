import { createRectangularStockMarket } from '@tabletop/18xx'

export function createShikoku1889StockMarket() {
    const market = createRectangularStockMarket(
        [
            [75, 80, 90, 100, 110, 125, 140, 155, 175, 200, 225, 255, 285, 315, 350],
            [70, 75, 80, 90, 100, 110, 125, 140, 155, 175, 200, 225, 255, 285, 315],
            [65, 70, 75, 80, 90, 100, 110, 125, 140, 155, 175, 200],
            [60, 65, 70, 75, 80, 90, 100, 110, 125, 140],
            [55, 60, 65, 70, 75, 80, 90, 100],
            [50, 55, 60, 65, 70, 75, 80],
            [45, 50, 55, 60, 65, 70],
            [40, 45, 50, 55, 60],
            [30, 40, 45, 50],
            [20, 30, 40, 45],
            [10, 20, 30, 40]
        ],
        (row, column) => {
            if (row >= 8 && column < row - 7) return 'orange'
            if (row >= 5 && column <= row - 5) return 'yellow'
            return row <= 5 && column === 3 ? 'pink' : 'white'
        }
    )
    return market
}
