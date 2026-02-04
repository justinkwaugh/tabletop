import {
    Body,
    Container,
    Head,
    Heading,
    Html,
    Link,
    Preview,
    Section,
    Tailwind,
    Text,
} from '@react-email/components'
import { GameResult } from '@tabletop/common'

interface GameEndProps {
    result: GameResult
    title: string
    gameName: string
    winners: string[]
    url?: string
}

export const GameEnd = ({ result, title, gameName, winners, url = `` }: GameEndProps) => {
    let previewText
    let resultLabel
    let resultColor
    if (result === GameResult.Draw) {
        previewText = `Your ${title} game ${gameName} has ended in a draw.`
        resultLabel = 'Draw'
        resultColor = 'text-[#b45309]'
    } else if (result === GameResult.Abandoned) {
        previewText = `Your ${title} game ${gameName} was abandoned.`
        resultLabel = 'Abandoned'
        resultColor = 'text-[#6b7280]'
    } else {
        previewText = `Your ${title} game ${gameName} has ended.`
        resultLabel = 'Win'
        resultColor = 'text-[#15803d]'
    }
    return (
        <Html>
            <Head />
            <Preview>{previewText}</Preview>
            <Tailwind>
                <Body className="bg-[#f3f4f6] my-0 mx-auto font-sans">
                    <Container className="my-[32px] mx-auto p-[24px] bg-white border border-[#e5e7eb]">
                        <Section className="mb-[16px]">
                            <Text className="text-[12px] uppercase tracking-[1.5px] text-[#6b7280] m-0">
                                Game Complete
                            </Text>
                            <Heading className="text-[#0f172a] my-[8px] mx-0 text-[28px] p-0 leading-[1.2]">
                                {title} has ended
                            </Heading>
                        </Section>

                        <Section className="bg-[#f8fafc] border border-[#e2e8f0] px-[16px] py-[14px] mb-[20px]">
                            <Text className="text-[13px] uppercase tracking-[1px] text-[#64748b] m-0">
                                Summary
                            </Text>
                            <Text className="text-[#0f172a] text-[18px] font-semibold m-0">
                                {gameName}
                            </Text>
                            <Text className={`text-[14px] m-0 ${resultColor}`}>
                                Result: {resultLabel}
                            </Text>
                        </Section>

                        {result === GameResult.Win ? (
                            <Section className="mb-[18px]">
                                <Text className="text-[#0f172a] text-[15px] leading-[1.6] m-0">
                                    Congratulations to:&nbsp;
                                    <span className="font-semibold">{winners.join(', ')}</span>
                                </Text>
                            </Section>
                        ) : null}

                        <Section className="text-center mb-[16px]">
                            <Link
                                href={url}
                                className="bg-[#0f172a] text-white no-underline px-[18px] py-[12px] rounded-[6px] inline-block text-[14px]"
                            >
                                Revisit the game
                            </Link>
                        </Section>

                        <Text className="text-[#64748b] text-[12px] leading-[1.6] m-0">
                            If the button does not work, copy and paste this link into your browser:{' '}
                            <span className="text-[#0f172a]">{url}</span>
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    )
}

GameEnd.PreviewProps = {
    result: GameResult.Win,
    title: 'Sol: Last Days of a Star',
    gameName: "Bob's Game of 4D Chess",
    winners: ['Alice', 'Bob'],
    url: '#',
} as GameEndProps

export default GameEnd
