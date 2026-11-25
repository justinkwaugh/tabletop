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
import { baseLocale, m, type Locale } from '../i18n.js'

interface GameEndProps {
    result: GameResult
    title: string
    gameName: string
    winners: string[]
    callKind?: GameCallKind
    url?: string
    locale: Locale
}

export const GameEnd = ({
    result,
    title,
    gameName,
    winners,
    callKind,
    url = ``,
    locale,
}: GameEndProps) => {
    const names = formatNames(winners, m.email_game_end_no_winner_names({}, { locale }), locale)
    const game = { title, game: gameName }
    const stalled = { ...game, days: STALLED_GAME_END_DAYS }
    let previewText: string
    let resultText: ReactNode
    if (result === GameResult.Draw) {
        previewText = m.email_game_end_preview_draw(game, { locale })
        resultText = m.email_game_end_result_draw({ names }, { locale })
    } else if (callKind === GameCallKind.Stalled) {
        previewText = m.email_game_end_preview_stalled(stalled, { locale })
        resultText = m.email_game_end_result_stalled(stalled, { locale })
    } else if (result === GameResult.Abandoned) {
        previewText = m.email_game_end_preview_abandoned(game, { locale })
        resultText = m.email_game_end_result_abandoned({}, { locale })
    } else {
        previewText = m.email_game_end_preview(game, { locale })
        resultText = (
            <>
                <span style={{ color: darkPalette.gold }}>★</span>{' '}
                {m.email_game_end_result_won({ names }, { locale })}
            </>
        )
    }
    return (
        <DarkCardEmail
            locale={locale}
            preview={previewText}
            wordmarkHref={url}
            heading={gameName}
            subline={m.email_game_end_subline({ title }, { locale })}
            footer={
                <>
                    {m.email_game_end_footer({}, { locale })}{' '}
                    <ButtonFallback url={url} locale={locale} />
                </>
            }
        >
            <Section style={styles.panel}>
                <Text style={styles.panelValue}>{resultText}</Text>
            </Section>
            <CardButton href={url}>{m.email_game_end_button({}, { locale })}</CardButton>
        </DarkCardEmail>
    )
}

GameEnd.PreviewProps = {
    result: GameResult.Win,
    title: 'Sol: Last Days of a Star',
    gameName: "Bob's Game of 4D Chess",
    winners: ['Alice', 'Bob'],
    url: 'https://boardtogether.games/game/qidEk1NjzIRBEioOpoCGD',
    locale: baseLocale,
} satisfies GameEndProps

export default GameEnd
