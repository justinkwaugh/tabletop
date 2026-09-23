import type { StockInstruction } from '@tabletop/18xx'

export type StockInstructionNames = {
    companyName: (id: string) => string
    poolName: (id: string) => string
}

export function stockInstructionText(
    instruction: StockInstruction,
    names: StockInstructionNames
): string {
    if (instruction.kind === 'pass') return 'Autopass for the rest of the round'
    const goal =
        instruction.until.kind === 'floated'
            ? 'until it floats'
            : `until ${instruction.until.count} ${instruction.until.count === 1 ? 'share' : 'shares'}`
    const follow = instruction.thenPass ? ' · then pass' : ''
    return `Autobuy ${names.companyName(instruction.companyId)} · ${names.poolName(instruction.preferredPoolId)} preferred · ${goal}${follow}`
}
