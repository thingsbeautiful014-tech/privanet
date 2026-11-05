# Security Specification - PrivaNet

## Data Invariants
1. A post must have a valid authorId matching the authenticated user.
2. Messages are only readable by the sender and receiver.
3. Users can only modify their own profile and posts.
4. Pseudonyms must be unique (enforced by application logic and rules where possible).
5. Timestamps must be server-generated.

## The "Dirty Dozen" Payloads (Denial Expected)
1. Creating a post with another user's `authorId`.
2. Reading a message where the user is neither `senderId` nor `receiverId`.
3. Updating a post's `content` after it's been deleted or by a non-owner.
4. Injecting a `role: 'admin'` into a user profile.
5. Creating a message with a 1MB `content` string (beyond our schema limit).
6. Updating `createdAt` on any document.
7. Deleting another user's post.
8. Listing all messages in the system (no collection group read without filters).
9. Spoofing `pseudonym` in a post to be someone else's.
10. Creating a notification for another user that doesn't originate from a real interaction.
11. Bypassing E2EE by attempting to read raw message data without being the recipient.
12. Creating a user profile with a 10KB pseudonym.

## Test Runner (Draft)
The tests will verify that the above payloads return `PERMISSION_DENIED`.
