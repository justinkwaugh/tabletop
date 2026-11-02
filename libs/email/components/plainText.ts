import { toPlainText } from '@react-email/components'

// html-to-text ships no types, so describe the parts a formatter here uses.
type DomNode = { type: string; data?: string; children?: DomNode[] }
type FormatCallback = (
    elem: DomNode,
    walk: unknown,
    builder: { addInline: (text: string) => void },
) => void

const nodeText = (node: DomNode): string =>
    node.type === 'text' ? (node.data ?? '') : (node.children ?? []).map(nodeText).join('')

// Each Column is its own block by default, which puts every standings cell on its own line.
const inlineColumnCell: FormatCallback = (elem, _walk, builder) => {
    builder.addInline(nodeText(elem).replace(/\s+/g, ' ').trim())
    builder.addInline(' ')
}

const textOptions = {
    selectors: [
        { selector: 'td[data-id="__react-email-column"]', format: 'inlineColumnCell' },
        // Both wordmark links go to the same page; their URLs would open the text.
        { selector: 'a[data-wordmark]', format: 'anchor', options: { ignoreHref: true } },
        // html-to-text capitalises headings, which would misspell usernames and game names.
        { selector: 'h1', options: { uppercase: false } },
    ],
    formatters: { inlineColumnCell },
}

export function emailPlainText(html: string): string {
    return toPlainText(html, textOptions)
        .replace(/\n{3,}/g, '\n\n')
        .trim()
}
