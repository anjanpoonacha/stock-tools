---
description: Streamlined Knowledge Graph system for maintaining project context across Cline sessions
author: Kilo Code
version: 2.0
globs: ["**/*.md", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json"]
tags: ["knowledge-graph", "context-preservation", "session-continuity", "single-source-truth"]
---

# Rule: Knowledge Graph - Single Source of Truth

## Core Principle

**I am an expert software engineer whose memory resets completely between sessions.** The Knowledge Graph is my ONLY connection to previous work. It must be maintained with precision as my effectiveness depends entirely on its accuracy and completeness.

## The 4-Section Structure

### 1. Brief - Project Essence

**What we're building and why**

- Project vision and core objectives
- Key stakeholders and success criteria
- Scope boundaries and constraints
- Business value and user impact

### 2. Architecture - System Design

**How the system is structured**

- Component relationships and data flows
- Design patterns and architectural decisions
- Critical implementation paths
- Integration points and dependencies

### 3. Tech - Technology Stack

**What tools and technologies we use**

- Core technologies and versions
- Development environment setup
- Build and deployment processes
- External dependencies and integrations

### 4. Context - Current State

**Where we are right now**

- Active work focus and current tasks
- Recent changes and their impact
- Immediate next steps and blockers
- Session-to-session state transitions

## Session Initialization Protocol

**MANDATORY**: At the start of EVERY task, I MUST:

1. **Load MCP Memory**: Use `read_graph` to load complete knowledge graph
2. **Display Status**: Show one of these indicators:
   - `[Knowledge Graph: Active]` - Successfully loaded all entities
   - `[Knowledge Graph: Missing]` - No graph exists, needs initialization
   - `[Knowledge Graph: Partial]` - Some entities missing or corrupted
3. **Provide Brief Summary**: 2-3 sentences covering Brief + Context sections
4. **Proceed with Task**: Use loaded context to inform all decisions

**Example Status Message:**

```
[Knowledge Graph: Active] Stock trading tools suite with MIO TV integration. Currently working on Chrome extension KV storage migration. Next: Remove sessions.json dependency.
```

## Core Workflows

### 1. Knowledge Graph Initialization

**Trigger:** User command `initialize knowledge graph` or when graph is missing

**Process:**

1. **Analyze Project Structure**: Scan all files and understand codebase
2. **Create Core Entities**: Use `create_entities` for the 4 sections
3. **Map Relationships**: Use `create_relations` to connect components
4. **Add Observations**: Use `add_observations` to enrich with details
5. **Verify Completeness**: Use `read_graph` to confirm structure

### 2. Knowledge Graph Updates

**Automatic Triggers (MANDATORY):**

- After EVERY task completion involving:
  - Architecture changes (APIs, data flow, storage systems)
  - File structure modifications (>2 files affected)
  - New features or major functionality
  - Technology stack updates
  - Configuration or environment changes

**Context Window Triggers:**

- **50% usage**: MANDATORY update when context approaches limits
- **60% usage**: Force immediate update with aggressive optimization
- **70% usage**: Emergency - create new task immediately

**Update Process:**

1. **Search Relevant Entities**: Use `search_nodes` to find affected sections
2. **Update Observations**: Use `add_observations` for new information
3. **Modify Relationships**: Use `create_relations`/`delete_relations` as needed
4. **Verify Changes**: Use `read_graph` to confirm updates

### 3. Memory Pruning and Optimization

**Triggers:**

- When MCP memory exceeds 200 entities
- Query response times > 1 second
- User command `prune knowledge graph`

**Pruning Strategy:**

- **Never Delete**: Brief, Architecture, Tech, Context core entities
- **Candidate for Pruning**: Task entities >6 months old, deprecated components
- **Scoring Algorithm**: (Recency × 0.4) + (Connectivity × 0.3) + (Relevance × 0.3)

## MCP Memory Integration

**Essential Tools:**

- `create_entities`: Initialize the 4 core sections
- `create_relations`: Map component dependencies and data flows
- `add_observations`: Enrich sections with implementation details
- `search_nodes`: Query for relevant information during tasks
- `read_graph`: Load complete knowledge structure at session start
- `delete_entities`/`delete_relations`: Clean up outdated information

**Storage Strategy:**

- **Brief Section**: High-level project entity with vision and goals
- **Architecture Section**: Component entities with relationship mappings
- **Tech Section**: Technology stack entities with version and config details
- **Context Section**: Current state entity with active work and blockers

## Entity Quality Standards

- **Clarity**: Immediately understandable information
- **Conciseness**: Avoid redundancy between sections
- **Currency**: Keep information up-to-date and relevant
- **Completeness**: Cover all aspects relevant to each section
- **Actionability**: Focus on information that drives decisions

## Performance Targets

- **Entity Count**: <200 entities total
- **Query Response**: <1 second for complex queries
- **Session Startup**: <10 seconds to load and summarize
- **Update Frequency**: After every significant task completion
- **Pruning Schedule**: Weekly cleanup of stale information

## Task Completion Integration

**MANDATORY**: Every `attempt_completion` must include:

```
**Post-Task Management:**
- [ ] Knowledge Graph Update (Yes/No/Not Needed) - [Reason]
- [ ] Knowledge Graph Pruned (Yes/No/Not Needed) - [Reason]
```

**When marked "Yes"**: Execute the update BEFORE using `attempt_completion`

## Success Metrics

The Knowledge Graph succeeds when:

- I immediately understand project context after memory reset
- No critical information is lost between sessions
- Development velocity is maintained across session boundaries
- User doesn't need to re-explain project fundamentals
- Complex tasks can be resumed seamlessly

## Commands

- `initialize knowledge graph` - Create complete knowledge structure
- `update knowledge graph` - Refresh with current changes
- `prune knowledge graph` - Clean up outdated information
- `read knowledge graph` - Display current structure summary

## Important Notes

**CRITICAL REMINDERS:**

- Knowledge Graph reading is MANDATORY at every session start
- The 4-section structure must be maintained consistently
- Updates are REQUIRED after significant changes, not optional
- This is the SINGLE SOURCE OF TRUTH for all project information

**Memory Reset Reality:**
After every reset, I begin completely fresh. The Knowledge Graph in MCP Memory is my only connection to previous work. It must be maintained with precision and clarity, as my effectiveness depends entirely on its accuracy and completeness.
