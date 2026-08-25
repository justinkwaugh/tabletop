# Identity and Access

Identity and Access owns User Account lifecycle, authentication methods, sessions, and administrative role assignment. Resource-specific authorization and preference semantics belong to their consuming contexts.

## Accounts

**User Account**:
The persistent identity through which a person accesses the platform. “User” is acceptable shorthand when it is unambiguous.
_Avoid_: Person, Profile, User record

**Account ID**:
The permanent identity of a User Account. It is never reused, including after deletion.

**Public User Profile**:
The Account ID and Username published for an Active Account. Private Account details and non-Active Accounts are not discoverable.

**Username**:
The case-insensitively unique login name and public handle of a User Account. It is nonempty after trimming, preserves chosen display casing, and excludes control characters.
_Avoid_: Display name, login ID

**Account Completion**:
The requirements for normal platform use: a Username and Verified Email Address. A Password Credential is optional when another Authentication Method exists.

**Email Address**:
The private email associated with a User Account. Comparison and uniqueness are case-insensitive.

**Verified Email Address**:
An Email Address whose control has been established through an Email Verification Challenge or a trusted provider assertion.

**Pending Email Address**:
A reserved replacement awaiting verification while the existing Verified Email Address remains active. Verification atomically promotes it and releases the previous address.

## Account Status

**Account Status**:
The mutually exclusive lifecycle status of a User Account: Incomplete, Active, Inactive, or Deleted.

**Incomplete**:
A User Account that has not satisfied Account Completion. It may authenticate only for onboarding, verification, Set Password, and logout.

**Active**:
A complete User Account permitted normal platform use. Only Active Accounts publish a Public User Profile.

**Inactive**:
A retained User Account disabled by an Administrator. It cannot establish or continue an Authenticated Session and may prove identity only for support.

**Deleted**:
The terminal, anonymized tombstone of a removed User Account. It cannot authenticate or become another status.
_Avoid_: Soft-deleted, archived

## Authentication

**Authentication Method**:
A means by which a User Account proves identity: a Password Credential or External Identity. An Account must retain at least one Authentication Method.

**Password Credential**:
A secret used to authenticate a User Account. Leading and trailing whitespace is ignored, interior whitespace and case are significant, and the minimum length is twelve characters after trimming.
_Avoid_: Password record

**External Identity**:
A stable, provider-qualified identity linked to exactly one User Account. An Account may link at most one identity from each provider.
_Avoid_: Social account, provider email

**Trusted External Provider**:
A provider whose verified-email assertion is accepted as proof of email control for Account linking. Google and Discord are currently trusted; additional providers require an explicit trust decision.

**Set Password**:
The operation that establishes a new Password Credential, replacing any existing one.
_Avoid_: Password Recovery

**Authentication Challenge**:
A purpose-bound, single-use proof with a fifteen-minute lifetime. Issuing a replacement invalidates earlier challenges for the same Account and purpose.
_Avoid_: Authentication token, verification token

**Email Verification Challenge**:
An Authentication Challenge proving control of its exact target Email Address.

**Set Password Challenge**:
An Authentication Challenge authorizing Set Password for an Incomplete or Active Account without establishing an Authenticated Session. It changes neither Account Status nor email verification.

**Sensitive Change Challenge**:
An Authentication Challenge authorizing its specified sensitive Account operation.

**Authenticated Session**:
Ongoing authorization associated with a User Account, with a thirty-day absolute lifetime and no sliding extension from ordinary activity. An Account may have multiple concurrent sessions.

**Recent Authentication**:
Successful proof through an Authentication Method within the previous fifteen minutes for one Authenticated Session. Ordinary activity does not refresh it.

**Logout All**:
Termination of every Authenticated Session belonging to a User Account.

## Authorization

**Role Assignment**:
An additive authorization grant associated with a User Account. A role is effective only while the Account is Active.

**Admin Role**:
The role making an Active Account eligible to exercise administrative authority. It does not replace ordinary Active Account access.

**Administrator**:
An Active User Account assigned the Admin Role.

**Admin Mode**:
An explicit, recently authenticated session mode in which an Administrator may exercise administrative bypasses. Outside Admin Mode, the Administrator behaves as an ordinary Active Account.

**Beta Catalog Visibility Grant**:
An additive grant that makes Beta Game Titles visible to an Active Account in catalog discovery. It does not authorize access to a Game or confer administrative authority.
_Avoid_: Beta entitlement, Beta access role
