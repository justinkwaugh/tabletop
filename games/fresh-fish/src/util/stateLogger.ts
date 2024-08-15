import chalk from 'chalk'
import { HydratedFreshFishGameState } from '../model/gameState.js'
import { LogColorizer } from './logColorizer.js'
import { HydratedGameBoard } from '../components/gameBoard.js'
import { CellType } from '../components/cells.js'
import { GoodsType } from '../definition/goodsType.js'
import { type StateLogger } from '@tabletop/common'

export class FreshFishStateLogger implements StateLogger {
    logState(state: HydratedFreshFishGameState) {
        const colorizer = playerColorizer(state)
        let legend = 'Legend: '
        state.players.forEach((player, index) => {
            legend += colorizer.colorize(player.playerId, `P${index + 1} `)
        })
        console.log(legend)
        logBoard(state.board, colorizer)
    }
}

function playerColorizer(state: HydratedFreshFishGameState): LogColorizer {
    const colorsByIndex = [
        chalk.cyanBright,
        chalk.redBright,
        chalk.greenBright,
        chalk.yellowBright,
        chalk.magentaBright
    ]
    const colorfuncs = new Map(
        state.players.map((player, index) => [player.playerId, colorsByIndex[index]] as const)
    )
    return new LogColorizer(colorfuncs)
}

export function logBoard(board: HydratedGameBoard, colorizer: LogColorizer) {
    const colIndices = board.cells[0]
        .map((cell, index) => {
            return index.toString()
        })
        .join('   ')
    console.log(chalk.grey(`     ${colIndices}`))
    console.log(`   ${'-'.repeat(board.cells[0].length * 4 + 1)}`)
    board.cells.forEach((row, index) => {
        let rowStr = `${index < 10 ? ' ' : ''}${chalk.grey(index)} |`
        row.forEach((cell) => {
            switch (cell.type) {
                case CellType.OffBoard:
                    rowStr += `${chalk.black('\u2588\u2588\u2588')}|`
                    break
                case CellType.Disk:
                    rowStr += ` ${colorizer.colorize(cell.playerId, '\u25CF')} |`
                    break
                case CellType.Empty:
                    rowStr += '   |'
                    break
                case CellType.Market:
                    rowStr += ' M |'
                    break
                case CellType.Road:
                    rowStr += ' + |'
                    break
                case CellType.Stall:
                    rowStr += ` ${colorizer.colorize(cell.playerId, letterForGoodType(cell.goodsType))} |`
                    break
                case CellType.Truck:
                    rowStr += ` ${chalk.whiteBright(letterForGoodType(cell.goodsType))} |`
                    break
            }
        })
        console.log(rowStr)
        console.log(`   ${'-'.repeat(board.cells[0].length * 4 + 1)}`)
    })
}

function letterForGoodType(type: GoodsType): string {
    switch (type) {
        case GoodsType.Cheese: {
            return 'C'
        }
        case GoodsType.Fish: {
            return 'F'
        }
        case GoodsType.IceCream: {
            return 'I'
        }
        case GoodsType.Lemonade: {
            return 'L'
        }
    }
}
