---
description: Task completion checklist rule that ensures proper knowledge management and context optimization at the end of every task
author: Kilo Code
version: 1.0
globs: ["**/*.md", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json"]
tags: ["task-completion", "knowledge-graph", "context-management", "workflow"]
---

# Rule: Task Completion Checklist

## Objective

Ensure that every task completion includes a standardized checklist for knowledge graph updates and context management decisions. This rule enforces consistent post-task maintenance and optimization practices.

## Instructions

**MANDATORY**: At the end of EVERY task completion (when using `attempt_completion`), you MUST include the following checklist in your result:

### Task Completion Checklist

```
**Post-Task Management:**
- [ ] Knowledge Graph Update (Yes/No/Not Needed) - [Reason]
- [ ] Knowledge Graph Pruned (Yes/No/Not Needed) - [Reason]
- [ ] Context Condensed (Yes/No/Not Applicable) - [Current usage: X%]
```

## Implementation Guidelines

### Knowledge Graph Update Assessment

**When to mark "Yes":**

- New features or components were added
- Architecture or technology stack changed
- Major refactoring occurred
- New patterns or workflows were established
- Critical bugs were fixed that affect understanding

**When to mark "No":**

- Minor bug fixes or cosmetic changes
- Simple configuration updates
- Documentation-only changes
- Cleanup tasks without functional impact

**When to mark "Not Needed":**

- Task was purely investigative
- No code or architecture changes occurred
- Changes were temporary or experimental

### Knowledge Graph Pruning Assessment

**When to mark "Yes":**

- Knowledge graph has grown significantly (approaching 200 entities)
- Multiple outdated or duplicate observations detected
- Performance degradation in knowledge graph queries
- After major refactoring that obsoletes previous entities
- User explicitly requests pruning for efficiency

**When to mark "No":**

- Knowledge graph is still lean and efficient
- Recent entities are all relevant and current
- No performance issues detected
- Simple tasks that don't affect graph size

**When to mark "Not Needed":**

- Knowledge graph was recently pruned
- Very few entities exist in the graph
- Task involved no knowledge graph changes

### Context Condensation Assessment

**When to mark "Yes":**

- Context window usage is above 50%
- Complex task with extensive conversation history
- Multiple iterations and revisions occurred
- User explicitly requests context management

**When to mark "No":**

- Context window usage is below 30%
- Simple, straightforward task
- Minimal back-and-forth conversation

**When to mark "Not Applicable":**

- Task is being completed in a fresh session
- Context window usage is optimal (30-50%)

## Example Usage

### Example 1: Feature Addition

```
**Post-Task Management:**
- [x] Knowledge Graph Update (Yes) - Added new Chrome extension TypeScript conversion patterns and build processes
- [ ] Knowledge Graph Pruned (No) - Knowledge graph is still lean and efficient
- [ ] Context Condensed (No) - Current usage: 36%
```

### Example 2: Minor Cleanup

```
**Post-Task Management:**
- [ ] Knowledge Graph Update (Not Needed) - Simple file cleanup with no architectural changes
- [ ] Knowledge Graph Pruned (Not Needed) - Task involved no knowledge graph changes
- [ ] Context Condensed (No) - Current usage: 25%
```

### Example 3: Complex Refactoring

```
**Post-Task Management:**
- [x] Knowledge Graph Update (Yes) - Major theme compliance refactoring affects multiple components
- [x] Knowledge Graph Pruned (Yes) - Major refactoring obsoleted previous entities
- [x] Context Condensed (Yes) - Current usage: 78%
```

## Enforcement

- **Automatic**: This checklist MUST appear in every `attempt_completion` result
- **Validation**: User can verify that proper post-task management is considered
- **Consistency**: Ensures no task completion skips knowledge management decisions

## Benefits

1. **Knowledge Continuity**: Ensures important changes are captured in the knowledge graph
2. **Context Optimization**: Prevents context window overflow through proactive management
3. **Session Planning**: Helps determine when new tasks should be created
4. **Audit Trail**: Provides clear record of post-task management decisions
5. **Workflow Consistency**: Standardizes task completion across all projects

## Integration with Other Rules

- **Works with**: `knowledge-graph.md` - Triggers knowledge graph updates when needed
- **Complements**: `baby-steps.md` - Ensures each completed step includes proper documentation

## Notes

- This checklist should be the **final section** of every task completion result
- Be honest and accurate in assessments - this affects future session effectiveness
- When in doubt about knowledge graph updates, err on the side of updating
- Context condensation decisions should consider both current usage and task complexity
- The checklist format should remain consistent for easy parsing and review
