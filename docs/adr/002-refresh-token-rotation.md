# ADR 002 — Refresh token rotation with reuse detection

**Status:** Accepted

**Context:** JWTs are stateless by default. If a refresh token is stolen and used, the attacker can silently maintain access. We need a way to detect token reuse.

**Decision:** Each time a refresh token is issued, its SHA-256 hash is stored on the User row (`refresh_token_hash`). On refresh: (1) decode the incoming token, (2) hash it, (3) compare to the stored hash. If they match, issue a new pair and update the hash. If they don't match, the token was reused — invalidate the session immediately by setting `refresh_token_hash = NULL` and return 401. This is the "refresh token rotation" pattern from RFC 6749 / OAuth 2.0 Security BCP.

**Consequences:** Token theft is detectable within one rotation cycle. One stored hash per user means only one active session; multi-device support would require a token family table (deferred to a future ADR).
