/** A certificate offered in a presidency exchange: its shares and its part of the company. */
export type ExchangeCertificate = { shares: number; percent: number }

const NumberWords = ['no', 'one', 'two', 'three', 'four', 'five']

/**
 * Names a set of certificates the outgoing president may take: "the last certificate (20%)"
 * for a title's named certificate of several shares, otherwise "two 10% certificates".
 */
export function exchangeChoiceWords(
    certificates: readonly ExchangeCertificate[],
    multiShare?: { name: string }
): string {
    const sizes = [...new Set(certificates.map((certificate) => certificate.shares))].toSorted(
        (a, b) => b - a
    )
    return sizes
        .map((shares) => {
            const group = certificates.filter((certificate) => certificate.shares === shares)
            const percent = group[0]?.percent ?? 0
            const count = NumberWords[group.length] ?? String(group.length)
            if (shares > 1 && multiShare) {
                const name = multiShare.name.toLowerCase()
                return group.length === 1 ? `the ${name} (${percent}%)` : `${count} ${name}s`
            }
            return `${count} ${percent}% certificate${group.length === 1 ? '' : 's'}`
        })
        .join(' and ')
}
