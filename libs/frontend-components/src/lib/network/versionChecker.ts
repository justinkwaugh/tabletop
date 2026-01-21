import type { ConfiguredMiddleware } from 'wretch'
import { compareVersions } from 'compare-versions'

export enum VersionChange {
    Rollback = 'rollback',
    MajorUpgrade = 'majorUpgrade',
    MinorUpgrade = 'minorUpgrade',
    PatchUpgrade = 'patchUpgrade'
}

export type VersionChangeCallback = (change: VersionChange, url: string) => void

export type VersionCheckerOptions = {
    resolveExpectedVersion: (url: string) => string | undefined
    headerName: string
    onVersionChange: VersionChangeCallback
}

const semverRegex =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

export type VersionCheckerMiddleware = (options: VersionCheckerOptions) => ConfiguredMiddleware
export const resolveVersionChange = (
    expectedVersion: string,
    responseVersion: string
): VersionChange | undefined => {
    const expectedMatch = expectedVersion.match(semverRegex)
    const responseMatch = responseVersion.match(semverRegex)
    if (!expectedMatch || !responseMatch) {
        return undefined
    }

    const comparison = compareVersions(responseVersion, expectedVersion)
    if (comparison === 0) {
        return undefined
    }
    if (comparison === -1) {
        return VersionChange.Rollback
    }

    const responseMajor = Number(responseMatch[1])
    const responseMinor = Number(responseMatch[2])
    const expectedMajor = Number(expectedMatch[1])
    const expectedMinor = Number(expectedMatch[2])

    if (responseMajor > expectedMajor) {
        return VersionChange.MajorUpgrade
    }
    if (responseMinor > expectedMinor) {
        return VersionChange.MinorUpgrade
    }
    return VersionChange.PatchUpgrade
}

export const checkVersion: VersionCheckerMiddleware =
    ({ resolveExpectedVersion, headerName, onVersionChange }) =>
    (next) =>
    (url, opts) => {
        try {
            return next(url, opts)
                .then((response) => {
                    const expectedVersion = resolveExpectedVersion(url)
                    if (!expectedVersion) {
                        return response
                    }
                    const responseVersion = response.headers.get(headerName)
                    if (!responseVersion) {
                        return response
                    }
                    const change = resolveVersionChange(expectedVersion, responseVersion)
                    if (change) {
                        onVersionChange(change, url)
                    }
                    return response
                })
                .catch((e) => {
                    throw e
                })
        } catch (e) {
            return Promise.reject(e)
        }
    }
