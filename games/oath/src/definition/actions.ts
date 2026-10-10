export enum ActionType {
    Travel = 'travel',
    Muster = 'muster',
    Trade = 'trade',
    Search = 'search',
    SearchResolve = 'searchResolve',
    Recover = 'recover',
    Campaign = 'campaign',
    /** R-5.5.3 — after the Citizens asked to join the defence have answered. */
    CampaignAttackPlans = 'campaignAttackPlans',
    /** R-5.5.3, R-7.5.2 */
    CampaignDefend = 'campaignDefend',
    /** R-4.3.5, R-7.3.4 — once each. */
    UseRestPower = 'useRestPower',
    /** R-5.5.5 — from revision 7, after the roll. */
    CampaignSkullLosses = 'campaignSkullLosses',
    CampaignSacrifice = 'campaignSacrifice',
    /** R-5.5.6.a */
    CampaignDefeatKills = 'campaignDefeatKills',
    CampaignResolveVictory = 'campaignResolveVictory',

    /** R-6.1 — faceup, or discard it. */
    PlayFacedownAdviser = 'playFacedownAdviser',
    /** R-6.2 */
    UseActionPower = 'useActionPower',
    /** R-6.3 */
    Peek = 'peek',
    /** R-6.1, R-9.4, R-6.6.1 */
    LetPeek = 'letPeek',
    /** R-6.5, R-6.5.a, R-6.5.b */
    MoveWarbands = 'moveWarbands',
    /** R-6.6.1 */
    OfferCitizenship = 'offerCitizenship',
    /** R-6.6.2 */
    ResolveCitizenshipOffer = 'resolveCitizenshipOffer',
    /** R-6.5.a, R-6.5.b, R-5.5.2.a */
    AnswerConsent = 'answerConsent',
    AnswerQuestion = 'answerQuestion',
    /** R-6.7 */
    ExileCitizen = 'exileCitizen',
    /** R-6.8 */
    SelfExile = 'selfExile',

    /** R-4.1 */
    ResolveWake = 'resolveWake',
    /** R-4.2 */
    EndActPhase = 'endActPhase',
    /** R-10.2 — a free action a power grants comes next or not at all. */
    ForgoFreeAction = 'forgoFreeAction',
    /** R-4.3 */
    CompleteRest = 'completeRest',
    /** R-3.3 */
    RollEndDie = 'rollEndDie',
    /** R-2.11.b — the outgoing holder chooses who takes the Oathkeeper title. */
    ResolveOathkeeper = 'resolveOathkeeper',
    /** R-2.11-H1 — the title changing hands, recorded as its own System Action. */
    TransferOathkeeper = 'transferOathkeeper',

    /** R-1.23.1–R-1.23.3 */
    SetupChoice = 'setupChoice'
}
