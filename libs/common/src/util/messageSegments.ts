import { assert } from './assertions.js'

export type MessagePart =
    | { type: 'text'; value: string }
    | { type: 'markup-start' | 'markup-end' | 'markup-standalone'; name: string }

export type MessageSegment =
    { type: 'text'; text: string } | { type: 'markup'; name: string; text: string }

export function messageSegments(parts: MessagePart[]): MessageSegment[] {
    const segments: MessageSegment[] = []
    let open: { name: string; text: string } | undefined
    for (const part of parts) {
        if (part.type === 'text') {
            if (open) open.text += part.value
            else segments.push({ type: 'text', text: part.value })
        } else if (part.type === 'markup-standalone') {
            assert(!open, `Markup {#${part.name}/} cannot sit inside {#${open?.name}}`)
            segments.push({ type: 'markup', name: part.name, text: '' })
        } else if (part.type === 'markup-start') {
            assert(!open, `Markup {#${part.name}} cannot sit inside {#${open?.name}}`)
            open = { name: part.name, text: '' }
        } else {
            assert(open?.name === part.name, `Markup {/${part.name}} closes nothing`)
            segments.push({ type: 'markup', ...open })
            open = undefined
        }
    }
    assert(!open, `Markup {#${open?.name}} is never closed`)
    return segments
}
