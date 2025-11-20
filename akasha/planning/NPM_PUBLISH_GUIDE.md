# NPM Publishing Guide for Akasha

## Prerequisites

1. **NPM Account**: Ensure you have an account on npmjs.com
2. **Organization Access**: Since the package is `@glossick/akasha`, you need access to the `@glossick` organization
3. **Authentication**: Logged in to npm via CLI

## Pre-Publish Checklist

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Version number updated in `package.json`
- [ ] README.md is up to date
- [ ] CHANGELOG updated (if you maintain one)
- [ ] Git commit and tag (recommended)

## Publishing Steps

### 1. Login to NPM

```bash
npm login
```

Enter your npm credentials when prompted.

### 2. Verify You're Logged In

```bash
npm whoami
```

Should show your npm username.

### 3. Check Current Version

```bash
cd akasha
cat package.json | grep version
```

Current version: `0.9.0`

### 4. Update Version (if needed)

For a patch release (bug fixes):
```bash
npm version patch
```

For a minor release (new features):
```bash
npm version minor
```

For a major release (breaking changes):
```bash
npm version major
```

Or manually edit `package.json`:
```json
{
  "version": "0.9.1"  // or 0.10.0, 1.0.0, etc.
}
```

### 5. Build the Package

```bash
npm run build
```

This compiles TypeScript and runs the ESM import fix script. The `prepublishOnly` script will also run this automatically.

### 6. Verify What Will Be Published

```bash
npm pack --dry-run
```

This shows what files will be included in the package. Should include:
- `dist/` (compiled JavaScript and types)
- `README.md`
- `LICENSE`
- `docs/` (documentation)
- `package.json`

### 7. Test the Package Locally (Optional)

```bash
npm pack
```

This creates a `.tgz` file. You can install it locally to test:
```bash
npm install ./akasha-0.9.0.tgz
```

### 8. Publish to NPM

**For Public Release:**
```bash
npm publish
```

**For Beta/RC Release:**
```bash
npm publish --tag beta
# or
npm publish --tag rc
```

**For Dry Run (verify without publishing):**
```bash
npm publish --dry-run
```

### 9. Verify Publication

Check on npmjs.com:
```
https://www.npmjs.com/package/@glossick/akasha
```

Or via CLI:
```bash
npm view @glossick/akasha
```

## Package Configuration

The `package.json` is configured with:

- **`prepublishOnly`**: Automatically runs `npm run build` before publishing
- **`files`**: Only publishes `dist/`, `README.md`, `LICENSE`, and `docs/`
- **`.npmignore`**: Excludes source files, tests, scripts, etc.

## Common Issues

### "You do not have permission to publish"

- Ensure you're logged in: `npm whoami`
- Check you have access to `@glossick` organization
- Verify package name matches your organization

### "Package name already exists"

- Version number needs to be incremented
- Check if version already exists: `npm view @glossick/akasha versions`

### "Missing files"

- Ensure `dist/` directory exists and is built
- Check `.npmignore` isn't excluding needed files
- Verify `files` field in `package.json`

## Versioning Strategy

Follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.10.0): New features, backward compatible
- **PATCH** (0.9.1): Bug fixes, backward compatible

## Post-Publish

1. **Create Git Tag** (if not done automatically):
   ```bash
   git tag v0.9.0
   git push origin v0.9.0
   ```

2. **Update CHANGELOG** (if maintained)

3. **Announce Release** (GitHub releases, etc.)

## Unpublishing (Emergency Only)

⚠️ **Warning**: Unpublishing can break users' builds. Only do this in emergencies.

```bash
npm unpublish @glossick/akasha@0.9.0
```

Or to unpublish entire package (within 72 hours):
```bash
npm unpublish @glossick/akasha --force
```

## Publishing from CI/CD

If you set up automated publishing, ensure:
- NPM token is set as secret: `NPM_TOKEN`
- Only publish on version tags or main branch
- Run tests before publishing

Example GitHub Actions:
```yaml
- name: Publish to NPM
  run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

