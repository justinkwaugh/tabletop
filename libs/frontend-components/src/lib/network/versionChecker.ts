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

                    if (compareVersions(responseVersion, version) === -1) {
                        onVersionChange(VersionChange.Rollback)
                    } else if (compareVersions(responseVersion, version) === 1) {
                        const [, responseMajor, responseMinor] =
                            responseVersion.match(semverRegex) ?? []
                        const [, expectedMajor, expectedMinor] = version.match(semverRegex) ?? []

                        if (responseMajor > expectedMajor) {
                            onVersionChange(VersionChange.MajorUpgrade)
                        } else if (responseMinor > expectedMinor) {
                            onVersionChange(VersionChange.MinorUpgrade)
                        }
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
