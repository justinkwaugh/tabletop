import type { ConfiguredMiddleware } from 'wretch'
import { compareVersions } from 'compare-versions'

export enum VersionChange {
    Rollback = 'rollback',
    MajorUpgrade = 'majorUpgrade',
    MinorUpgrade = 'minorUpgrade',
    PatchUpgrade = 'patchUpgrade'
}

export type VersionChangeCallback = (change: VersionChange) => void

export type VersionCheckerOptions = {
    version?: string
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
    ({ version, onVersionChange }) =>
    (next) =>
    (url, opts) => {
        try {
            return next(url, opts)
                .then((response) => {
                    if (!version) {
                        return response
                    }

                    const responseVersion = response.headers.get('X-Tabletop-Version')
                    if (!responseVersion) {
                        return response
                    }

                    const change = resolveVersionChange(version, responseVersion)
                    if (change) {
                        onVersionChange(change)
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
