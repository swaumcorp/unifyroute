# UnifyRoute confbackup Feature Implementation

## Overview
Implemented a dedicated configuration backup system that organizes backups with unique IDs and metadata tracking.

## Files Modified

### 1. `.gitignore`
**Change:** Added `confbackup/` to exclude the backup folder from version control

### 2. `scripts/setup.py`

#### New Constants Added (Lines 33-34)
```python
CONFBACKUP_DIR = ROOT / "confbackup"
METADATA_FILENAME = "metadata.json"
```

#### New Utility Functions Added

- **`generate_backup_id() -> str`** (Lines 408-410)
  - Generates unique backup ID with format: `backup_YYYYMMDD_HHMMSS`
  - Example: `backup_20260312_214200`

- **`create_metadata_file(backup_dir: Path, backup_id: str, reason: str) -> None`** (Lines 413-436)
  - Creates metadata.json in each backup folder
  - Stores: backup_id, created_at (ISO 8601), reason, includes list, size_bytes, description

- **`get_backup_metadata(backup_id: str) -> dict | None`** (Lines 439-449)
  - Reads and parses metadata.json from a backup folder
  - Returns dict with backup metadata or None if not found

- **`list_backups() -> list[tuple[str, dict]]`** (Lines 452-466)
  - Scans confbackup/ directory for backup folders
  - Returns list of (backup_id, metadata) tuples sorted by timestamp descending

- **`save_backup_to_confbackup(backup_id: str, reason: str, backup_ts: str) -> bool`** (Lines 469-503)
  - Moves temporary .env.backup.{ts} and .db.backup.{ts} files to confbackup/{backup_id}/
  - Creates metadata.json for the backup
  - Returns True on success, False on failure

- **`cleanup_temp_backups(backup_ts: str) -> None`** (Lines 506-514)
  - Deletes temporary backup files from root directory
  - Used when user chooses not to preserve backup during uninstall

#### Modified Functions

- **`find_saved_configs() -> list[tuple[str, dict]]`** (Lines 227-231)
  - **Before:** Scanned root for `.env.backup.*` files and returned timestamps
  - **After:** Scans confbackup/ using list_backups() and returns (backup_id, metadata) tuples
  - Reduces code duplication by delegating to list_backups()

- **`restore_config(backup_id: str) -> dict[str, str]`** (Lines 234-268)
  - **Before:** Took timestamp, restored from root `.env.backup.{ts}` and `.db.backup.{ts}`
  - **After:** Takes backup_id, restores from `confbackup/{backup_id}/`
  - Includes better error handling and warning messages

- **`cmd_install()` - Backup Restoration Section** (Lines 585-602)
  - **Before:** Always prompted for restore if saved_configs exist
  - **After:**
    - Only shows restore prompt if backups exist in confbackup/
    - Shows user-friendly backup list with metadata (timestamp, reason, size)
    - Passes backup_id instead of timestamp to restore_config()

- **`cmd_uninstall()` - Added Step 4: Backup Management** (Lines 957-980)
  - **New:** After cleanup, asks user "Preserve this backup for future restores?"
  - **If YES:**
    - Generates backup_id using generate_backup_id()
    - Calls save_backup_to_confbackup() to move backups to confbackup/{backup_id}/
    - Shows confirmation message with backup location
  - **If NO:**
    - Calls cleanup_temp_backups() to delete temporary backup files
    - Shows "Backup discarded" message

## Directory Structure

```
UnifyRoute/
├── confbackup/                    ← NEW: Dedicated backup folder
│   ├── backup_20260312_214200/
│   │   ├── .env                   ← Restored .env configuration
│   │   ├── unifyroute.db          ← Database backup
│   │   └── metadata.json          ← Backup metadata (created_at, reason, size, etc.)
│   ├── backup_20260311_153045/
│   │   ├── .env
│   │   ├── unifyroute.db
│   │   └── metadata.json
│   └── (more backup folders...)
├── data/                          ← Unchanged
└── scripts/setup.py               ← Modified
```

## New UX Flows

### Install Flow
```
Check if confbackup/ has backups
  ↓
  YES → Show prompt: "Found X saved configurations. Restore one?"
         → If YES: Show list with metadata (date, reason, size)
                  → User selects backup ID
                  → Restore from confbackup/{backup_id}/
                  → Skip interactive config
         → If NO: Fresh install (proceed with interactive setup)

  NO → Fresh install (skip restore prompt entirely)
```

### Uninstall Flow
```
Cleanup (existing steps)
  ↓
NEW: Ask "Preserve this backup for future restores? [Y/n]"
  → If YES:
    - Generate backup_id: backup_20260312_214200
    - Move .env.backup.{ts} → confbackup/{backup_id}/.env
    - Move .db.backup.{ts} → confbackup/{backup_id}/unifyroute.db
    - Create confbackup/{backup_id}/metadata.json
    - Print: "Backup saved to confbackup/{backup_id}/"

  → If NO:
    - Delete temporary .env.backup.{ts} and .db.backup.{ts}
    - Print: "Backup discarded."
```

## Metadata File Example

```json
{
  "backup_id": "backup_20260312_214200",
  "created_at": "2026-03-12T21:42:00.123456",
  "reason": "uninstall",
  "includes": ["env", "database"],
  "description": "Configuration backup from uninstall",
  "size_bytes": 122880
}
```

## Backward Compatibility

- Old `.env.backup.*` and `.db.backup.*` files at root are preserved but ignored
- No breaking changes to environment variables or configuration structure
- First install/refresh will only use confbackup/ going forward
- Users can manually migrate old backups if needed

## Testing Checklist

- [x] Script syntax check passes
- [ ] Fresh install → verify confbackup/ not created
- [ ] Install → uninstall preserve → verify confbackup/{backup_id}/ created with metadata
- [ ] Re-install → verify restore prompt shows backup with metadata
- [ ] Select restore → verify .env and database restored correctly
- [ ] Uninstall don't preserve → verify backup not created, temp files deleted
- [ ] Multiple installs/uninstalls → verify multiple backup_ids in confbackup/
- [ ] Test restore with oldest/newest backup selection
- [ ] Verify metadata.json has correct data for each backup

## Code Statistics

- **Lines added:** ~150 (new utility functions)
- **Lines modified:** ~100 (cmd_install, cmd_uninstall, find_saved_configs, restore_config)
- **Complexity:** Medium (new directory structure, metadata management)
- **Risk:** Low (backward compatible, additive feature)

