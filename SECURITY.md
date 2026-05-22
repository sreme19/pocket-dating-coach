# Security: Android Release Signing

## Keystore Management

The release keystore (`release.keystore`) is used to sign production Android App Bundles (AAB) for Google Play Store submission. This file **must never** be committed to version control.

### Keystore Generation

```bash
keytool -genkey -v -keystore release.keystore -alias pocket-dating-coach -keyalg RSA -keysize 2048 -validity 10000
```

### Password Storage

Keystore passwords **must** be stored in a secrets manager — never in source code, build scripts, or version-controlled configuration files.

Recommended secrets managers:
- **GitHub Actions**: Use repository secrets (`KEYSTORE_PASSWORD`, `KEY_PASSWORD`)
- **Google Cloud Secret Manager**: For CI/CD pipelines
- **1Password / Bitwarden**: For individual developer access
- **AWS Secrets Manager**: For team environments

### Local Development

For local release builds, create `android/keystore.properties` (gitignored) with:

```properties
storeFile=../release.keystore
storePassword=<from secrets manager>
keyAlias=pocket-dating-coach
keyPassword=<from secrets manager>
```

This file is listed in `.gitignore` and must not be committed.

### CI/CD Integration

In CI/CD environments (e.g., GitHub Actions), inject keystore credentials as environment variables:

```yaml
env:
  KEYSTORE_PATH: ${{ secrets.KEYSTORE_PATH }}
  KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
  KEY_ALIAS: pocket-dating-coach
  KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
```

The `android/app/build.gradle` signing config reads from these environment variables or falls back to `keystore.properties` for local builds.

## Files Excluded from Version Control

The following entries in `.gitignore` prevent accidental secret exposure:

| Pattern | Purpose |
|---------|---------|
| `*.jks` | Java KeyStore files |
| `*.keystore` | Android keystore files |
| `android/keystore.properties` | Local signing credentials |
| `android/app/release.keystore` | Release keystore (explicit path) |
| `google-services.json` | Firebase project configuration |
| `android/app/google-services.json` | Firebase config in Android project |

## Server-Side API Keys

The following API keys exist **only** on the server (Vercel environment variables) and must **never** appear in the Android source, resources, or assets:

- **Anthropic API key** — Claude AI access
- **Supabase service role key** — Admin database access
- **Voyage AI key** — Embedding generation
- **fal.ai key** — Image generation

The Android app communicates exclusively with the Vercel deployment over HTTPS. All API keys remain server-side and are never exposed to the client.
