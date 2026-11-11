# Password policy deployment

The app validates new registration and replacement passwords: at least eight characters, a digit, and a non-whitespace special character. Existing passwords can still be used to sign in. A change requires the current password: the app verifies it with Supabase and supplies `current_password` to the update request. Passwords are never written to local storage by this flow.

## Supabase configuration required

The hosted Auth service must enforce the policy too; browser validation alone can be bypassed by direct API calls. No Supabase Management API access token is configured in this workspace, so hosted settings have **not** been changed or verified by this implementation. The backend service-role key does not authorize Management API configuration.

In the project's Authentication password security settings:

- Set minimum password length to **8** (`password_min_length`).
- Enable **Require current password when changing password** (`security_update_password_require_current_password`). This is distinct from requiring a recent session or email reauthentication.
- Configure required characters to include digits and symbols (`password_required_characters`). Hosted presets may additionally require uppercase/lowercase letters; if choosing such a preset, update the app's shared `frontend/src/services/passwordPolicy.js` and displayed requirements to match it.

After configuration, verify directly against Auth in a test project: weak signup passwords must be rejected, and a password update with a missing or incorrect current password must fail even when using a valid session. The automated browser tests mock Auth and verify the app's requests; they do not establish the hosted project's policy.

References: [Supabase password security](https://supabase.com/docs/guides/auth/password-security), [Auth configuration API](https://supabase.com/docs/reference/api/v1-update-auth-service-config).
