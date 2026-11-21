export interface PlannedToken {
    readonly token: string
    readonly light: string
    readonly dark: string
}

/** A first cell of backticked names; `-suffix` shares the previous name's first word. */
function namesInCell(cell: string): string[] {
    let stem = ''
    return [...cell.matchAll(/`(-?[a-z-]+)`/g)].map((match) => {
        const name = match[1]
        if (name.startsWith('-')) {
            return `${stem}${name}`
        }
        stem = name.split('-')[0]
        return name
    })
}

/** A cell's colours as CSS writes them: `#RRGGBB at N %` is `#rrggbbaa`. */
function valuesInCell(cell: string): string[] {
    return [...cell.matchAll(/`(#[0-9A-Fa-f]{6,8})`(?: at (\d+) %)?/g)].map(([, hex, percent]) =>
        percent
            ? `${hex}${Math.round((Number(percent) / 100) * 255)
                  .toString(16)
                  .padStart(2, '0')}`.toLowerCase()
            : hex.toLowerCase()
    )
}

/** The art plan's Palette table, one row per token: a row's one value serves each of its names, and a Dark of "same" is the Light. */
export function plannedPalette(artPlan: string): PlannedToken[] {
    const start = artPlan.indexOf('\n## Palette\n')
    const rest = artPlan.slice(start + '\n## Palette\n'.length)
    const end = rest.indexOf('\n##')
    return (end < 0 ? rest : rest.slice(0, end))
        .split('\n')
        .filter((line) => line.startsWith('| `'))
        .flatMap((row) => {
            const [, names, , light, dark] = row.split('|')
            const lights = valuesInCell(light)
            const darks = valuesInCell(dark)
            return namesInCell(names).map((name, index) => {
                const light = lights[index] ?? lights[0]
                return { token: `feudum-${name}`, light, dark: darks[index] ?? darks[0] ?? light }
            })
        })
}
