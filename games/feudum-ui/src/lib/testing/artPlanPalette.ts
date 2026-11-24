export interface PlannedToken {
    readonly token: string
    readonly light: string
    readonly dark: string
}

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

function valuesInCell(cell: string): string[] {
    return [...cell.matchAll(/`(#[0-9A-Fa-f]{6,8})`(?: at (\d+) %)?/g)].map(([, hex, percent]) =>
        percent
            ? `${hex}${Math.round((Number(percent) / 100) * 255)
                  .toString(16)
                  .padStart(2, '0')}`.toLowerCase()
            : hex.toLowerCase()
    )
}

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
