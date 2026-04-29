// Shared copy for the "Resume SMS" confirmation text. Sent both when a
// user re-subscribes from Settings (POST /api/profile/sms/resume) and
// when an admin re-enables SMS for an opted-out user from the SMS
// health roster (POST /api/admin/sms/users/:userId/re-enable). Keep
// the wording in one place so both surfaces stay in sync.
export const SMS_RESUME_CONFIRM_BODY =
  "You're re-subscribed to GigAid messages. Reply STOP at any time to opt out.";
