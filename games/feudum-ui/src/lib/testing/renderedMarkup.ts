import { Color } from '@tabletop/common'
import type { FeudumGameSession } from '$lib/model/session.svelte.js'

/** Elements whose implicit role takes no name: a screen reader drops an aria-label on them. */
export const Unnamed = new Set([
    'b',
    'caption',
    'code',
    'del',
    'div',
    'em',
    'i',
    'ins',
    'p',
    'small',
    'span',
    'strong',
    'sub',
    'sup'
])

const NamedColour = /^(?:white|black|red|blue|green|yellow|purple|gray|grey)$/
const RawColours = [
    /#[0-9a-fA-F]{3,8}\b/g,
    /\b(?:rgba?|hsla?|oklch)\([^)]*\)/g,
    /(?<![\w-])(?:bg|text|border(?:-[trblxy])?|ring|outline|divide|from|via|to|fill|stroke|decoration|shadow)-(?:(?:stone|amber|rose|gray|slate|zinc|neutral|sky|red|blue|green|yellow|purple|orange|pink|indigo|teal|lime|emerald|cyan|violet|fuchsia)-\d{2,3}|white|black)(?:\/\d+)?(?![\w-])/g,
    /(?<![\w-])(?:fill|stroke|color|background(?:-color)?|border-color):\s*(?:white|black|red|blue|green|yellow|purple|gray|grey)\b/g
]
const TokenUse =
    /(?:--|(?:bg|text|border|ring|outline|fill|stroke|from|via|to)-)(feudum-[a-z-]+?)(?:\/\d+)?(?![\w{$-])/g
const TokenUtility = /^(?:[\w-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to)-feudum-/
const Painted = ['class', 'style', 'fill', 'stroke', 'color', 'stop-color', 'flood-color']

export type MarkupElement = Pick<Element, 'localName' | 'getAttribute' | 'hasAttribute'>

export interface MarkupRules {
    /** Colours the platform's colourizer hands out for seats, painted as given. */
    readonly seatColours: ReadonlySet<string>
    readonly declared: (token: string) => boolean
    /** Whether a stylesheet on the page has a rule for this class. */
    readonly styled: (className: string) => boolean
    /** The title's component that drew the element, or undefined for markup the title does not own. */
    readonly drawnBy: (element: MarkupElement) => string | undefined
}

export function rawColoursIn(text: string): string[] {
    const raw = RawColours.flatMap((pattern) =>
        [...text.matchAll(pattern)].map((match) => match[0].toLowerCase())
    )
    return NamedColour.test(text.trim()) ? [...raw, text.trim()] : raw
}

/** A `#rrggbb` colour as the CSS object model writes it back into a style attribute. */
export function serialisedRgb(hex: string): string {
    const [red, green, blue] = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
    return `rgb(${red}, ${green}, ${blue})`
}

/** Contract, Palette and S71: what the title draws names no raw colour and no undeclared token, and puts no aria-label where it names nothing. */
export function markupProblems(elements: readonly MarkupElement[], rules: MarkupRules): string[] {
    return elements.flatMap((element) => {
        const file = rules.drawnBy(element)
        if (!file) {
            return []
        }
        const where = `${file} <${element.localName}>`
        const unnamed =
            Unnamed.has(element.localName) &&
            element.hasAttribute('aria-label') &&
            !element.hasAttribute('role')
        const classes = (element.getAttribute('class') ?? '').split(/\s+/)
        const unstyled = classes.filter(
            (className) => TokenUtility.test(className) && !rules.styled(className)
        )
        return [
            ...(unnamed ? [`${where}: an aria-label on an element that takes no name`] : []),
            ...unstyled.map((className) => `${where} class: no utility ${className}`),
            ...Painted.flatMap((attribute) => {
                const value = element.getAttribute(attribute) ?? ''
                const raw = rawColoursIn(value).filter((colour) => !rules.seatColours.has(colour))
                const undeclared = [...value.matchAll(TokenUse)]
                    .map((match) => match[1])
                    .filter((token) => !rules.declared(token))
                return [
                    ...raw.map((colour) => `${where} ${attribute}: raw colour ${colour}`),
                    ...undeclared.map((token) => `${where} ${attribute}: undeclared ${token}`)
                ]
            })
        ]
    })
}

type SeatColourSource = Pick<
    FeudumGameSession['colors'],
    | 'getUiColor'
    | 'getBgColor'
    | 'getBgColorValue'
    | 'getTextColor'
    | 'getTextColorValue'
    | 'getBorderColor'
    | 'getBorderColorValue'
>

/** Svelte's dev build tags each element with the component file that drew it. */
function titleFileOf(element: MarkupElement): string | undefined {
    const meta = '__svelte_meta' in element ? element.__svelte_meta : undefined
    const loc = typeof meta === 'object' && meta !== null && 'loc' in meta ? meta.loc : undefined
    const file = typeof loc === 'object' && loc !== null && 'file' in loc ? loc.file : undefined
    return typeof file === 'string' && file.startsWith('src/') ? file : undefined
}

function classesStyledOnPage(): Set<string> {
    const classes = new Set<string>()
    const walk = (rules: CSSRuleList) => {
        for (const rule of rules) {
            if (rule instanceof CSSStyleRule) {
                for (const [, name] of rule.selectorText.matchAll(/\.((?:\\.|[\w-])+)/g)) {
                    classes.add(name.replace(/\\(.)/g, '$1'))
                }
            }
            if (rule instanceof CSSGroupingRule) {
                walk(rule.cssRules)
            }
        }
    }
    for (const sheet of document.styleSheets) {
        // A cross-origin stylesheet's rules cannot be read, and no such sheet is the title's.
        try {
            walk(sheet.cssRules)
        } catch {
            continue
        }
    }
    return classes
}

/** The rules for the table under `root`, with the seat colours the session's colourizer gives. */
export function tableMarkupProblems(root: Element, colors: SeatColourSource): string[] {
    const given = Object.values(Color).flatMap((color) =>
        [
            colors.getUiColor(color),
            colors.getBgColor(color),
            colors.getBgColorValue(color),
            colors.getTextColor(color),
            colors.getTextColorValue(color),
            colors.getBorderColor(color),
            colors.getBorderColorValue(color)
        ].flatMap((value) => [...value.matchAll(/#[0-9a-fA-F]{6}\b/g)].map(([hex]) => hex))
    )
    const seatColours = new Set(
        given.flatMap((hex) => [hex.toLowerCase(), serialisedRgb(hex.toLowerCase())])
    )
    const style = getComputedStyle(root)
    const styled = classesStyledOnPage()
    return markupProblems([root, ...root.querySelectorAll('*')], {
        seatColours,
        declared: (token) => style.getPropertyValue(`--${token}`) !== '',
        styled: (className) => styled.has(className),
        drawnBy: titleFileOf
    })
}
