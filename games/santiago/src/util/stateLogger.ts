import chalk from 'chalk'
import { type GameStateLogger } from '@tabletop/common'
import { HydratedSantiagoGameState } from '../model/gameState.js'
import { SquareType, CropType } from '../model/board.js'

export class SantiagoStateLogger implements GameStateLogger {
    logState(state: HydratedSantiagoGameState) {
        console.log(
            chalk.bold(`\nRound ${state.round} — ${state.machineState}`) +
                (state.canalOverseerId ? `  Canal overseer: ${state.canalOverseerId}` : '')
        )
        console.log(chalk.grey(`Tile bag: ${state.tileBag.length} remaining`))
        logBoard(state)
        for (const p of state.players) {
            console.log(`  ${p.playerId}  money=${p.money}  score=${p.score}`)
        }
    }
}

function logBoard(state: HydratedSantiagoGameState) {
    const { board } = state
    const colHeaders = Array.from({ length: 8 }, (_, i) => i.toString()).join('  ')
    console.log(chalk.grey(`    ${colHeaders}`))
    console.log(`   ${'---'.repeat(8)}`)
    for (let row = 0; row < 6; row++) {
        let rowStr = `${chalk.grey(row)} |`
        for (let col = 0; col < 8; col++) {
            const sq = board.squares[col][row]
            if (sq.type === SquareType.Empty) {
                rowStr += sq.hasPalmTree ? chalk.yellow(' P ') : ' . '
            } else {
                // FieldSquare — show crop letter; dim if dried; suffix P if palm tree colocated
                const letter = sq.hasPalmTree
                    ? cropLetter(sq.crop) + 'p'
                    : ` ${cropLetter(sq.crop)} `
                rowStr += sq.dried ? chalk.grey(letter) : chalk.green(letter)
            }
        }
        console.log(rowStr)
    }
    console.log(`   ${'---'.repeat(8)}`)
    console.log(
        `   Spring: (${board.spring.col},${board.spring.row})  Canals: ${board.canals.length}`
    )
}

function cropLetter(crop: CropType): string {
    return crop[0].toUpperCase()
}
