import { Fragment, type ReactNode } from 'react'
import { assertExists, messageSegments, type MessagePart } from '@tabletop/common'

export const RichMessage = ({
    parts,
    markup,
}: {
    parts: MessagePart[]
    markup: Record<string, (text: string) => ReactNode>
}) => (
    <>
        {messageSegments(parts).map((segment, index) => {
            if (segment.type === 'text') return <Fragment key={index}>{segment.text}</Fragment>
            const render = markup[segment.name]
            assertExists(render, `Nothing renders the message markup {#${segment.name}}`)
            return <Fragment key={index}>{render(segment.text)}</Fragment>
        })}
    </>
)
