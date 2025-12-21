#!/bin/bash

#===============================================================================
# SWR Migration Cleanup Script
#===============================================================================
# 
# This script automates the cleanup process after SWR migration testing.
# It performs the following operations:
# 1. Deletes old hook files (4 files, 1,278 lines)
# 2. Renames .swr.ts files to .ts (4 files)
# 3. Updates any remaining imports from .swr to standard imports
# 4. Verifies the changes
#
# Usage:
#   ./scripts/cleanup-swr-migration.sh              # With safety prompts
#   ./scripts/cleanup-swr-migration.sh --no-prompt  # Skip prompts (dangerous)
#   ./scripts/cleanup-swr-migration.sh --dry-run    # Show what would be done
#
# Safety Features:
#   - Creates backup before any changes
#   - Prompts for confirmation at each step
#   - Verifies files exist before operations
#   - Runs type check after cleanup
#   - Provides rollback instructions
#
#===============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
HOOKS_DIR="src/hooks"
BACKUP_DIR="src/hooks.backup.$(date +%Y%m%d_%H%M%S)"

# Files to delete (old versions)
OLD_FILES=(
  "${HOOKS_DIR}/useKVSettings.ts"
  "${HOOKS_DIR}/useMioSync.ts"
  "${HOOKS_DIR}/useTvSync.ts"
  "${HOOKS_DIR}/useWatchlistIntegration.ts"
)

# Files to rename (.swr.ts → .ts)
SWR_FILES=(
  "${HOOKS_DIR}/useKVSettings.swr.ts"
  "${HOOKS_DIR}/useMioSync.swr.ts"
  "${HOOKS_DIR}/useTvSync.swr.ts"
  "${HOOKS_DIR}/useWatchlistIntegration.swr.ts"
)

# Parse command line arguments
SKIP_PROMPTS=false
DRY_RUN=false

for arg in "$@"; do
  case $arg in
    --no-prompt)
      SKIP_PROMPTS=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help|-h)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --no-prompt   Skip all confirmation prompts (use with caution)"
      echo "  --dry-run     Show what would be done without making changes"
      echo "  --help, -h    Show this help message"
      echo ""
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $arg${NC}"
      echo "Use --help for usage information"
      exit 1
      ;;
  esac
done

#===============================================================================
# Helper Functions
#===============================================================================

print_header() {
  echo ""
  echo -e "${BLUE}=======================================================================${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${BLUE}=======================================================================${NC}"
  echo ""
}

print_step() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_info() {
  echo -e "${BLUE}ℹ $1${NC}"
}

confirm() {
  if [ "$SKIP_PROMPTS" = true ]; then
    return 0
  fi
  
  read -p "$(echo -e "${YELLOW}$1 (y/n): ${NC}")" -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    return 1
  fi
  return 0
}

check_file_exists() {
  if [ ! -f "$1" ]; then
    print_error "File not found: $1"
    return 1
  fi
  return 0
}

#===============================================================================
# Main Script
#===============================================================================

print_header "SWR Migration Cleanup Script"

if [ "$DRY_RUN" = true ]; then
  print_warning "DRY RUN MODE - No changes will be made"
  echo ""
fi

# Show summary
echo "This script will perform the following operations:"
echo ""
echo "1. Create backup of hooks directory"
echo "2. Delete 4 old hook files (1,278 lines total):"
for file in "${OLD_FILES[@]}"; do
  echo "   - $file"
done
echo ""
echo "3. Rename 4 .swr.ts files to .ts (1,127 lines total):"
for file in "${SWR_FILES[@]}"; do
  echo "   - $file → ${file%.swr.ts}.ts"
done
echo ""
echo "4. Update imports (remove .swr references)"
echo "5. Run type check to verify changes"
echo ""

if ! confirm "Do you want to proceed?"; then
  print_info "Cleanup cancelled by user"
  exit 0
fi

#===============================================================================
# Step 1: Create Backup
#===============================================================================

print_header "Step 1: Creating Backup"

if [ "$DRY_RUN" = false ]; then
  if [ -d "$HOOKS_DIR" ]; then
    cp -r "$HOOKS_DIR" "$BACKUP_DIR"
    print_step "Backup created: $BACKUP_DIR"
    print_info "To restore: rm -rf $HOOKS_DIR && cp -r $BACKUP_DIR $HOOKS_DIR"
  else
    print_error "Hooks directory not found: $HOOKS_DIR"
    exit 1
  fi
else
  print_info "[DRY RUN] Would create backup: $BACKUP_DIR"
fi

#===============================================================================
# Step 2: Verify Files Exist
#===============================================================================

print_header "Step 2: Verifying Files"

# Check old files exist
print_info "Checking old hook files..."
OLD_FILES_EXIST=0
for file in "${OLD_FILES[@]}"; do
  if check_file_exists "$file"; then
    OLD_FILES_EXIST=$((OLD_FILES_EXIST + 1))
    lines=$(wc -l < "$file" | tr -d ' ')
    size=$(du -h "$file" | cut -f1)
    echo "  ✓ $file ($lines lines, $size)"
  else
    print_warning "Old file not found: $file (may have been deleted already)"
  fi
done

echo ""

# Check .swr.ts files exist
print_info "Checking .swr.ts hook files..."
SWR_FILES_EXIST=0
for file in "${SWR_FILES[@]}"; do
  if check_file_exists "$file"; then
    SWR_FILES_EXIST=$((SWR_FILES_EXIST + 1))
    lines=$(wc -l < "$file" | tr -d ' ')
    size=$(du -h "$file" | cut -f1)
    echo "  ✓ $file ($lines lines, $size)"
  else
    print_error "SWR file not found: $file (cleanup may have already been done)"
    exit 1
  fi
done

echo ""

if [ $OLD_FILES_EXIST -eq 0 ]; then
  print_warning "No old files found to delete. Cleanup may have already been done."
  if ! confirm "Continue anyway?"; then
    print_info "Cleanup cancelled"
    exit 0
  fi
fi

if [ $SWR_FILES_EXIST -ne 4 ]; then
  print_error "Not all .swr.ts files found. Expected 4, found $SWR_FILES_EXIST"
  exit 1
fi

print_step "All required files verified"

#===============================================================================
# Step 3: Delete Old Hook Files
#===============================================================================

print_header "Step 3: Deleting Old Hook Files"

if ! confirm "Delete $OLD_FILES_EXIST old hook files?"; then
  print_info "Skipping deletion step"
else
  for file in "${OLD_FILES[@]}"; do
    if [ -f "$file" ]; then
      if [ "$DRY_RUN" = false ]; then
        rm "$file"
        print_step "Deleted: $file"
      else
        print_info "[DRY RUN] Would delete: $file"
      fi
    fi
  done
  
  if [ "$DRY_RUN" = false ]; then
    print_step "Old hook files deleted successfully"
  fi
fi

#===============================================================================
# Step 4: Rename .swr.ts Files to .ts
#===============================================================================

print_header "Step 4: Renaming .swr.ts Files"

if ! confirm "Rename 4 .swr.ts files to .ts?"; then
  print_info "Skipping rename step"
else
  for file in "${SWR_FILES[@]}"; do
    if [ -f "$file" ]; then
      new_file="${file%.swr.ts}.ts"
      
      # Check if target file already exists
      if [ -f "$new_file" ] && [ "$DRY_RUN" = false ]; then
        print_warning "Target file already exists: $new_file"
        if ! confirm "Overwrite?"; then
          print_info "Skipping: $file"
          continue
        fi
      fi
      
      if [ "$DRY_RUN" = false ]; then
        mv "$file" "$new_file"
        print_step "Renamed: $file → $new_file"
      else
        print_info "[DRY RUN] Would rename: $file → $new_file"
      fi
    fi
  done
  
  if [ "$DRY_RUN" = false ]; then
    print_step "Files renamed successfully"
  fi
fi

#===============================================================================
# Step 5: Update Imports
#===============================================================================

print_header "Step 5: Updating Imports"

print_info "Searching for .swr imports in source files..."

# Find all .swr imports
SWR_IMPORTS=$(grep -r "\.swr'" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)

if [ -z "$SWR_IMPORTS" ]; then
  print_step "No .swr imports found - all imports are already updated"
else
  echo "$SWR_IMPORTS" | while IFS= read -r line; do
    echo "  $line"
  done
  echo ""
  
  if confirm "Update all .swr imports to standard imports?"; then
    if [ "$DRY_RUN" = false ]; then
      # Use sed to remove .swr from imports
      # macOS uses sed -i '', Linux uses sed -i
      if [[ "$OSTYPE" == "darwin"* ]]; then
        find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' "s/from '\(.*\)\.swr'/from '\1'/g" {} +
      else
        find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s/from '\(.*\)\.swr'/from '\1'/g" {} +
      fi
      print_step "Imports updated successfully"
      
      # Show what was changed
      print_info "Verifying changes..."
      REMAINING=$(grep -r "\.swr'" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
      if [ -z "$REMAINING" ]; then
        print_step "All .swr imports removed"
      else
        print_warning "Some .swr imports remain:"
        echo "$REMAINING"
      fi
    else
      print_info "[DRY RUN] Would update imports in all TypeScript files"
    fi
  else
    print_info "Skipping import updates"
    print_warning "You will need to manually update imports in your components"
  fi
fi

#===============================================================================
# Step 6: Verify Changes
#===============================================================================

print_header "Step 6: Verifying Changes"

if [ "$DRY_RUN" = false ]; then
  print_info "Checking hooks directory..."
  echo ""
  
  # List hooks directory
  echo "Current hooks directory:"
  ls -lh "$HOOKS_DIR"/*.ts 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}'
  echo ""
  
  # Verify no .swr.ts files remain
  if ls "$HOOKS_DIR"/*.swr.ts 1> /dev/null 2>&1; then
    print_warning "Some .swr.ts files still exist:"
    ls -lh "$HOOKS_DIR"/*.swr.ts
  else
    print_step "No .swr.ts files found (cleanup complete)"
  fi
  
  echo ""
  
  # Check for import errors
  print_info "Checking for import errors..."
  IMPORT_ERRORS=$(grep -r "\.swr'" src/ --include="*.ts" --include="*.tsx" 2>/dev/null || true)
  if [ -z "$IMPORT_ERRORS" ]; then
    print_step "No .swr imports found"
  else
    print_warning "Found .swr imports that need manual fixing:"
    echo "$IMPORT_ERRORS"
  fi
else
  print_info "[DRY RUN] Verification would check:"
  print_info "  - No .swr.ts files remain in hooks directory"
  print_info "  - No .swr imports remain in source files"
fi

#===============================================================================
# Step 7: Run Type Check
#===============================================================================

print_header "Step 7: Running Type Check"

if [ "$DRY_RUN" = false ]; then
  if confirm "Run TypeScript type check?"; then
    print_info "Running: pnpm run type-check || npx tsc --noEmit"
    echo ""
    
    if command -v pnpm &> /dev/null; then
      if pnpm run type-check 2>&1 || npx tsc --noEmit 2>&1; then
        echo ""
        print_step "Type check passed"
      else
        echo ""
        print_error "Type check failed"
        print_warning "There may be import errors or type issues"
        print_info "Review the output above and fix any errors"
        exit 1
      fi
    else
      print_warning "pnpm not found, skipping type check"
      print_info "Manually run: pnpm run type-check"
    fi
  else
    print_info "Skipping type check"
    print_warning "Remember to run: pnpm run type-check"
  fi
else
  print_info "[DRY RUN] Would run type check: pnpm run type-check"
fi

#===============================================================================
# Step 8: Final Summary
#===============================================================================

print_header "Cleanup Complete"

if [ "$DRY_RUN" = false ]; then
  echo -e "${GREEN}✓ SWR migration cleanup completed successfully!${NC}"
  echo ""
  echo "Summary of changes:"
  echo "  • Old hook files deleted: $OLD_FILES_EXIST files"
  echo "  • .swr.ts files renamed to .ts: $SWR_FILES_EXIST files"
  echo "  • Imports updated (if any .swr references found)"
  echo "  • Backup created: $BACKUP_DIR"
  echo ""
  echo "Next steps:"
  echo "  1. Run tests: pnpm run test"
  echo "  2. Run build: pnpm run build"
  echo "  3. Start dev server: pnpm dev"
  echo "  4. Test all functionality manually"
  echo "  5. Commit changes: git add . && git commit -m 'Complete SWR migration cleanup'"
  echo ""
  echo "If you encounter any issues:"
  echo "  • Restore from backup: rm -rf $HOOKS_DIR && cp -r $BACKUP_DIR $HOOKS_DIR"
  echo "  • Or revert git: git checkout HEAD src/hooks/"
  echo ""
  echo -e "${GREEN}Happy coding! 🚀${NC}"
else
  print_info "[DRY RUN] No changes were made"
  echo ""
  echo "To actually perform cleanup, run:"
  echo "  ./scripts/cleanup-swr-migration.sh"
  echo ""
  echo "Or to skip prompts:"
  echo "  ./scripts/cleanup-swr-migration.sh --no-prompt"
fi

echo ""

exit 0
