# Android `keystore.properties` Fill Guide

Use this guide when creating:

- `frontend/android/keystore.properties`

Optional local starter template:

- `frontend/android/keystore.properties.local.template`

This file should exist only on the machine used to build the signed Android
release. Do not commit it.

## Exact File Format

Create a file named:

```text
frontend/android/keystore.properties
```

Use this exact structure:

```properties
storeFile=release-keystore.jks
storePassword=your_store_password
keyAlias=release_key_alias
keyPassword=your_key_password
```

## Line-By-Line Meaning

### `storeFile=...`

What it is:

- the path to the keystore file used for signing

Allowed examples:

```properties
storeFile=release-keystore.jks
```

or

```properties
storeFile=C:\\secure\\android-signing\\release-keystore.jks
```

Use:

- just the filename if the keystore sits in `frontend/android/`
- an absolute path if it lives elsewhere on your machine

Do not use:

- a path to a missing file
- a placeholder that does not exist

### `storePassword=...`

What it is:

- the password protecting the keystore file itself

Use:

- the exact password you entered when creating the keystore

Do not use:

- quotes around the password unless the real password includes them
- placeholder text such as `replace_with_strong_password`

### `keyAlias=...`

What it is:

- the alias of the signing key inside the keystore

Use:

- the exact alias passed to `keytool`, for example:

```properties
keyAlias=release_key_alias
```

Do not use:

- a guessed alias
- a different alias than the one used to generate the keystore

### `keyPassword=...`

What it is:

- the password for the key alias inside the keystore

Use:

- the exact key password set during keystore generation

Note:

- this may be the same as `storePassword`, but it does not have to be

## Safe Example For This Repo

If your keystore is stored directly in `frontend/android/` and you used the
same alias name as the runbook example:

```properties
storeFile=release-keystore.jks
storePassword=YOUR_REAL_STORE_PASSWORD
keyAlias=release_key_alias
keyPassword=YOUR_REAL_KEY_PASSWORD
```

## Quick Validation

From `frontend/android/`:

```powershell
Test-Path .\keystore.properties
Get-Content .\keystore.properties
Test-Path .\release-keystore.jks
```

Confirm:

- the file exists
- all four keys are present
- no placeholder values remain
- the keystore file exists where `storeFile` says it does

## Do Not Commit

Never commit:

- `frontend/android/keystore.properties`
- `release-keystore.jks`
- any file containing the real passwords

## Next Step

After the file is filled correctly, continue with:

- `documents/release-evidence/android-keystore-setup-checklist.md`
- `documents/release-evidence/android-signed-release-runbook.md`
