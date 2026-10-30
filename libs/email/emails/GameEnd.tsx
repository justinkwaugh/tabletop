import { Section, Text } from '@react-email/components'
import { GameCallKind, GameResult, STALLED_GAME_END_DAYS } from '@tabletop/common'
import type { ReactNode } from 'react'
import {
    ButtonFallback,
    CardButton,
    DarkCardEmail,
    darkPalette,
    darkStyles as styles,
    formatNames,
} from '../components/darkCard.js'

interface GameEndProps {
    result: GameResult
    title: string
    gameName: string
    winners: string[]
    callKind?: GameCallKind
    url?: string
}

export const GameEnd = ({ result, title, gameName, winners, callKind, url = `` }: GameEndProps) => {
    const winnerNames = formatNames(winners, 'Someone')
    let previewText: string
    let resultText: ReactNode
    if (result === GameResult.Draw) {
        previewText = `Your ${title} game ${gameName} has ended in a draw.`
        resultText = `${winnerNames} tied`
    } else if (callKind === GameCallKind.Stalled) {
        previewText = `Your ${title} game ${gameName} ended with no move in ${STALLED_GAME_END_DAYS} days.`
        resultText = `Nobody moved for ${STALLED_GAME_END_DAYS} days, so the game ended with no winner`
    } else if (result === GameResult.Abandoned) {
        previewText = `Your ${title} game ${gameName} was abandoned.`
        resultText = 'The game was abandoned'
    } else {
        previewText = `Your ${title} game ${gameName} has ended.`
        resultText = (
            <>
                <span style={{ color: darkPalette.gold }}>★</span> {winnerNames} won!
            </>
        )
    }
    return (
        <DarkCardEmail
            preview={previewText}
            wordmarkHref={url}
            heading={gameName}
            subline={`Your game of ${title} has ended.`}
            footer={
                <>
                    You played in this game on Board Together. <ButtonFallback url={url} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>{resultText}</Text>
            </Section>
            <CardButton href={url}>Revisit the game</CardButton>
        </DarkCardEmail>
    )
}

GameEnd.PreviewProps = {
    result: GameResult.Win,
    title: 'Sol: Last Days of a Star',
    gameName: "Bob's Game of 4D Chess",
    winners: ['Alice', 'Bob'],
    url: 'https://boardtogether.games/game/qidEk1NjzIRBEioOpoCGD',
} satisfies GameEndProps

export default GameEnd
