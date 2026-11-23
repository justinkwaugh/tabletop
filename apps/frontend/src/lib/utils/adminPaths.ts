export const ADMIN_TABS = ['users', 'games', 'stats'] as const

export type AdminTab = (typeof ADMIN_TABS)[number]

export interface AdminUsersView {
    query: string
    userId: string
}

export function adminTabPath(tab: AdminTab): string {
    return `/admin/${tab}`
}

export function adminTabOf(pathname: string): AdminTab | undefined {
    return ADMIN_TABS.find((tab) => pathname === adminTabPath(tab))
}

export function parseAdminUsersView(params: URLSearchParams): AdminUsersView {
    return { query: params.get('q') ?? '', userId: params.get('user') ?? '' }
}

export function adminUsersPath({ query, userId }: AdminUsersView): string {
    return withSearch(adminTabPath('users'), { q: query, user: userId })
}

export function parseAdminGamesTitle(params: URLSearchParams): string {
    return params.get('title') ?? ''
}

export function adminGamesPath(titleId: string): string {
    return withSearch(adminTabPath('games'), { title: titleId })
}

function withSearch(path: string, values: Record<string, string>): string {
    const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value))
    const search = params.toString()
    return search ? `${path}?${search}` : path
}
