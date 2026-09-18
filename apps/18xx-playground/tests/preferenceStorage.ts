import type { Page } from '@playwright/test'

export function storedFamilyPreference(page: Page, preference: string) {
    return page.evaluate((preference) => {
        const key = Object.keys(localStorage).find(
            (key) => key.includes('harness:preferences:') && key.includes('family:18xx')
        )
        return key ? JSON.parse(localStorage.getItem(key)!).values[preference] : null
    }, preference)
}
