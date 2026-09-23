import type { StockInstruction, StockInstructionStopReason } from '@tabletop/18xx'
import type { TitleStopReason } from '../session/titlePresentation.js'

export type StockInstructionNames = {
    companyName: (id: string) => string
    poolName: (id: string) => string
}

export function stockInstructionKindLabel(kind: StockInstruction['kind']): string {
    return kind === 'pass' ? 'Autopass' : 'Autobuy'
}

export function stockInstructionText(
    instruction: StockInstruction,
    names: StockInstructionNames
): string {
    if (instruction.kind === 'pass')
        return `${stockInstructionKindLabel('pass')} for the rest of the round`
    const goal =
        instruction.until.kind === 'floated'
            ? 'until float'
            : `until I own ${instruction.until.count}`
    const follow = instruction.thenPass ? ' · then pass' : ''
    return `${stockInstructionKindLabel('buy')} ${names.companyName(instruction.companyId)} · ${names.poolName(instruction.preferredPoolId)} preferred · ${goal}${follow}`
}

export function stopReasonText(
    reason: StockInstructionStopReason,
    names: StockInstructionNames,
    titleText?: (reason: TitleStopReason) => string
): string {
    switch (reason.code) {
        case 'limits':
            return 'shares must be sold to meet the limits'
        case 'cannot-finish':
            return 'the turn cannot be finished'
        case 'company-started':
            return `${names.companyName(reason.companyId)} was started`
        case 'president-changed':
            return `${names.companyName(reason.companyId)} changed president`
        case 'shares-sold':
            return `${names.companyName(reason.companyId)} shares were sold`
        case 'presidency-threatened':
            return `${names.companyName(reason.companyId)} presidency is threatened`
        case 'goal-met':
            return `the ${names.companyName(reason.companyId)} goal was met`
        case 'no-shares':
            return `no ${names.companyName(reason.companyId)} shares remain for sale`
        case 'cannot-afford':
            return `a ${names.companyName(reason.companyId)} share is no longer affordable`
        case 'ownership-limit':
            return `another ${names.companyName(reason.companyId)} share would exceed the ownership limit`
        case 'certificate-limit':
            return `another ${names.companyName(reason.companyId)} certificate would exceed the certificate limit`
        case 'mixed-certificates':
            return `${names.poolName(reason.poolId)} offers ${names.companyName(reason.companyId)} certificates of different sizes`
        case 'purchase-rejected':
            return `${names.companyName(reason.companyId)} cannot be bought from ${names.poolName(reason.poolId)}`
        case 'title':
            return titleText?.(reason) ?? reason.key
    }
}
