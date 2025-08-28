---
description: Project-specific preferences for package management and UI consistency
author: Project Team
version: 1.0
globs: ["**/*.md", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json"]
tags: ["package-management", "ui-consistency", "development-standards"]
---

# Rule: Project Development Preferences

## Objective

Ensure consistent development practices by enforcing pnpm usage for package management and using icons instead of emojis for better accessibility and visual consistency.

## Instructions

### 1. Package Management - Use pnpm Only

- **Always use pnpm** for all package management operations
- **Never suggest npm or yarn** commands
- **Convert any npm/yarn commands** to pnpm equivalents automatically

**Command Conversions:**

- `npm install` → `pnpm install`
- `npm install <package>` → `pnpm add <package>`
- `npm install -D <package>` → `pnpm add -D <package>`
- `npm run <script>` → `pnpm run <script>` or `pnpm <script>`
- `npm uninstall <package>` → `pnpm remove <package>`
- `yarn add <package>` → `pnpm add <package>`
- `yarn remove <package>` → `pnpm remove <package>`

### 2. UI Elements - Use Icons Instead of Emojis

- **Use lucide-react icons** for all UI elements
- **Avoid emojis** in code, comments, and UI text
- **Import icons explicitly** from lucide-react

**Preferred Icon Usage:**

```tsx
import { Check, X, AlertCircle, Info, Settings, User } from 'lucide-react'

// Good - Using lucide-react icons
<Check className="w-4 h-4 text-green-500" />
<AlertCircle className="w-4 h-4 text-yellow-500" />

// Avoid - Using emojis
// ✅ ❌ ⚠️ ℹ️ ⚙️ 👤
```

**Common Icon Replacements:**

- ✅ → `<Check />`
- ❌ → `<X />`
- ⚠️ → `<AlertTriangle />`
- ℹ️ → `<Info />`
- ⚙️ → `<Settings />`
- 👤 → `<User />`
- 📁 → `<Folder />`
- 📄 → `<File />`
- 🔍 → `<Search />`
- ➕ → `<Plus />`
- ➖ → `<Minus />`
- 🏠 → `<Home />`

## Workflow

1. **Before suggesting any package command:**
   - Check if it uses npm or yarn
   - Convert to pnpm equivalent
   - Explain the conversion if asked

2. **When adding UI elements:**
   - Scan for emoji usage
   - Suggest appropriate lucide-react icons
   - Provide import statements

3. **Code Review Checks:**
   - Verify pnpm usage in scripts and documentation
   - Ensure consistent icon usage across components
   - Flag any emoji usage for replacement

## Examples

### Package Management

```bash
# Correct
pnpm install
pnpm add react-query
pnpm add -D @types/node
pnpm run dev
pnpm remove unused-package

# Incorrect - Will be auto-converted
# npm install
# yarn add react-query
```

### Icon Usage

```tsx
// Correct - Using lucide-react
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'

const StatusIndicator = ({ status }: { status: 'success' | 'error' | 'warning' }) => {
  switch (status) {
    case 'success':
      return <CheckCircle className="w-5 h-5 text-green-500" />
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />
    case 'warning':
      return <AlertTriangle className="w-5 h-5 text-yellow-500" />
  }
}

// Incorrect - Using emojis
// const StatusIndicator = ({ status }) => {
//   return status === 'success' ? '✅' : status === 'error' ? '❌' : '⚠️'
// }
```

## Notes

- This project uses pnpm as evidenced by the `pnpm-lock.yaml` file
- lucide-react is already installed and provides comprehensive icon coverage
- Icons are more accessible than emojis and maintain consistent styling
- pnpm offers better performance and disk space efficiency than npm/yarn
- These preferences ensure consistency across the entire development team

## Enforcement

- **Automatic**: Convert npm/yarn commands to pnpm equivalents
- **Suggest**: Recommend icon replacements when emojis are detected
- **Validate**: Check new code for compliance with these standards
- **Document**: Update any documentation to reflect these preferences
