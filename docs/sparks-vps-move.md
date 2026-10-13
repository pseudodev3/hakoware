# Restore Sparks after the VPS move

The current Railway trial database cannot build Sparks' required write indexes because the volume lacks MongoDB's minimum free space. The user has deferred publishing until the VPS move. This change adds preparation and verification tools; it does not remove the disk guard or claim that production publishing is restored.

1. Back up the current MongoDB database and privately stored media, and verify that the backup can be restored. Preserve existing User IDs, Spark records, notification history and object-storage keys.
2. Provision persistent MongoDB storage with enough free space for data growth and index builds. Keep MongoDB's disk-space protections enabled. Restrict database access to the API rather than exposing it publicly.
3. Restore into the new database. Configure the API's `MONGO_URI`, existing JWT/auth settings, bucket variables and `FRONTEND_URL=https://hakoware.xyz`. Verify existing authentication, avatars and private voice/media reads before changing traffic.
4. From the server directory, run `npm run sparks:readiness`. This command reads index definitions and reports missing constraints without creating indexes or modifying data.
5. After the restored backup and available storage are confirmed, run `npm run sparks:prepare`. It creates only Sparks' required post, reply, reaction and corresponding notification indexes. It does not drop indexes, delete records or prepare unrelated historical notification constraints. Duplicate historical data or inadequate storage fails visibly and requires investigation.
6. Run `npm run sparks:readiness` again, then test a real post, photo, reaction and reply with two accepted accounts and an unrelated account. Check that the unrelated account cannot read private Sparks and that retrying a publish/reply does not duplicate it. Confirm notification delivery and media access.
7. Point the frontend's `API_URL` to the new HTTPS API origin and allow that exact origin in the frontend Content Security Policy before cutover. Keep the currently working Railway origin available during validation. Update the Stripe webhook endpoint if the API hostname changes.

The preparation tools were verified in an isolated database: missing collections, blocked index creation, recovery after restoring the standard disk threshold, and repeated preparation all behaved correctly. The existing Sparks storage-recovery suite continues to cover recovery without restarting the API.

A successful local index check does not establish that VPS storage, DNS, TLS, database access or live two-account publishing is configured. No production database migration was performed in this task.
