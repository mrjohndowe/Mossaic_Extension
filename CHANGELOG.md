# Changelog

All notable changes to **Mosaic for Reddit: Media Wall** are documented here.

## [Unreleased]

### Added
- Added a dedicated website and landing page.
- Added image tile browsing for the project website.
- Added a lightbox viewer for website images.
- Added TypeScript configuration for the website.
- Added Vite-based website build configuration.
- Added React and Tailwind CSS support for the website.
- Added automated GitHub Actions version maintenance tooling.

### Changed
- Updated website dependencies, including Vite and esbuild.
- Improved project maintenance and dependency update workflows.

### Maintenance
- Updated GitHub Actions dependencies to version 5.
- Added automated dependency update support through Dependabot.

---

## [2.4.6] - 2026-10-05

### Changed
- Updated the extension version to **2.4.6**.

---

## [2.4.5] - 2026-10-05

### Fixed
- Removed an unintended trailing space from the extension name in `manifest.json`.

---

## [2.4.4] - 2026-10-05

### Added
- Added optional password protection for exported backups.
- Added AES-GCM encryption for password-protected backup files.
- Added PBKDF2 key derivation using SHA-256.
- Added 100,000 PBKDF2 iterations for password-derived encryption keys.
- Added a unique random salt for each encrypted backup.
- Added a unique initialization vector for each encrypted backup.
- Added encrypted backup detection during import.
- Added password prompts for encrypted backup restoration.
- Added decryption error handling for incorrect passwords or corrupted backups.

### Compatibility
- Existing unencrypted backups remain supported.
- Users can continue exporting backups without a password.

---32
## [2.4.3] - 2026-10-05

### Fixed
- Improved error handling in the background service worker.
- Improved error handling when retrieving
