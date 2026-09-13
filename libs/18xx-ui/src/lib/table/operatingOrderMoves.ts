import type { HistoryOperatingOrder } from './historyOperatingOrder.js'

export type OperatingOrderMove = {
    companies: string[]
    from: number
    to: number
}

export function operatingOrderMoves({ before, after, movingCompanyId }: HistoryOperatingOrder): OperatingOrderMove[] {
    if (before.length !== after.length || before.some((id) => !after.includes(id))) return []
    const lengths = Array.from({ length: before.length + 1 }, () =>
        Array<number>(after.length + 1).fill(0)
    )
    for (let i = before.length - 1; i >= 0; i--)
        for (let j = after.length - 1; j >= 0; j--)
            lengths[i][j] = before[i] === after[j]
                ? 1 + lengths[i + 1][j + 1]
                : Math.max(lengths[i + 1][j], lengths[i][j + 1])
    const stationary = new Set<string>()
    let i = 0
    let j = 0
    while (i < before.length && j < after.length) {
        if (before[i] === after[j]) {
            stationary.add(before[i])
            i++
            j++
        } else if (lengths[i + 1][j] >= lengths[i][j + 1]) i++
        else j++
    }
    if (movingCompanyId) {
        const unchangedBefore = before.filter((id) => id !== movingCompanyId)
        const unchangedAfter = after.filter((id) => id !== movingCompanyId)
        if (unchangedBefore.every((id, index) => id === unchangedAfter[index])) {
            stationary.clear()
            for (const id of unchangedBefore) stationary.add(id)
        }
    }
    const current = [...before]
    const moves: OperatingOrderMove[] = []
    for (let target = after.length - 1; target >= 0; target--) {
        const company = after[target]
        if (stationary.has(company)) continue
        const from = current.indexOf(company)
        const next = after[target + 1]
        const insertion = next === undefined ? current.length : current.indexOf(next)
        const to = insertion > from ? insertion - 1 : insertion
        if (from === to) continue
        const start = Math.min(from, to)
        const companies = current.slice(start, Math.max(from, to) + 1)
        if (from < to) companies.push(company)
        else companies.unshift(company)
        moves.push({ companies, from: from < to ? 0 : companies.length - 1, to: from < to ? companies.length - 1 : 0 })
        current.splice(from, 1)
        current.splice(to, 0, company)
    }
    return moves
}
