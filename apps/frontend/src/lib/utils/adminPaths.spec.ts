import { describe, expect, it } from 'vitest'
import {
    adminGamesPath,
    adminTabOf,
    adminTabPath,
    adminUsersPath,
    parseAdminGamesTitle,
    parseAdminUsersView
} from './adminPaths'

const paramsOf = (path: string) => new URL(path, 'http://site').searchParams

describe('admin paths', () => {
    it('gives each tab its own path', () => {
        expect(adminTabPath('games')).toBe('/admin/games')
        expect(adminTabOf('/admin/stats')).toBe('stats')
        expect(adminTabOf('/admin/moderate/game-1')).toBeUndefined()
    })

    it('keeps the chosen title in the games path', () => {
        expect(adminGamesPath('')).toBe('/admin/games')
        expect(adminGamesPath('freshfish')).toBe('/admin/games?title=freshfish')
        expect(parseAdminGamesTitle(paramsOf(adminGamesPath('freshfish')))).toBe('freshfish')
        expect(parseAdminGamesTitle(paramsOf('/admin/games'))).toBe('')
    })

    it('keeps the user search and selection in the users path', () => {
        expect(adminUsersPath({ query: '', userId: '' })).toBe('/admin/users')
        const view = { query: 'ann & bob', userId: 'u1' }
        expect(adminUsersPath(view)).toBe('/admin/users?q=ann+%26+bob&user=u1')
        expect(parseAdminUsersView(paramsOf(adminUsersPath(view)))).toEqual(view)
    })
})
