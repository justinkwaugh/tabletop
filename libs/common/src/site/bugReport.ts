import * as Type from 'typebox'

export const BUG_REPORT_DESCRIPTION_MAX_LENGTH = 2000

export type BugReportView = Type.Static<typeof BugReportView>
export const BugReportView = Type.Object({
    actionCount: Type.Optional(Type.Integer({ minimum: 0 })),
    inHistory: Type.Boolean(),
    exploring: Type.Boolean()
})

export type BugReportVersions = Type.Static<typeof BugReportVersions>
export const BugReportVersions = Type.Object({
    site: Type.Optional(Type.String({ maxLength: 64 })),
    logic: Type.Optional(Type.String({ maxLength: 64 })),
    ui: Type.Optional(Type.String({ maxLength: 64 }))
})

export type BugReportClient = Type.Static<typeof BugReportClient>
export const BugReportClient = Type.Object({
    userAgent: Type.String({ maxLength: 512 }),
    viewport: Type.String({ maxLength: 64 }),
    installedApp: Type.Boolean()
})

export type BugReportRequest = Type.Static<typeof BugReportRequest>
export const BugReportRequest = Type.Object(
    {
        gameId: Type.String({ minLength: 1 }),
        description: Type.String({
            minLength: 1,
            maxLength: BUG_REPORT_DESCRIPTION_MAX_LENGTH
        }),
        view: BugReportView,
        versions: BugReportVersions,
        client: BugReportClient
    },
    { additionalProperties: false }
)
