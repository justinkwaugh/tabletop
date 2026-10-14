import { assertExists } from '@tabletop/common'

/** A title's printed names for its companies and certificate pools; State records only ids. */
export interface TitleNames {
    company(companyId: string): string
    pool(poolId: string): string
}

export function titleNames(
    companies: Readonly<Record<string, string>>,
    pool: (poolId: string) => string | undefined
): TitleNames {
    return {
        company(companyId) {
            const name = companies[companyId]
            assertExists(name, `Unnamed company: ${companyId}`)
            return name
        },
        pool(poolId) {
            const name = pool(poolId)
            assertExists(name, `Unnamed certificate pool: ${poolId}`)
            return name
        }
    }
}
