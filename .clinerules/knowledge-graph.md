---
description: Knowledge Graph system for maintaining context and knowledge across Cline sessions using structured entity-relationship principles
author: Kilo Code
version: 1.0
globs: ["**/*.md", "**/*.ts", "**/*.tsx", "**/*.js", "**/*.jsx", "**/*.json"]
tags: ["knowledge-graph", "context-preservation", "entity-relationships", "session-continuity"]
---

# Rule: Knowledge Graph Context Preservation

## Objective

Implement a comprehensive Knowledge Graph system that preserves project context, knowledge, and progress across Cline sessions using structured entity-relationship principles. This system ensures continuity and prevents loss of critical information when memory resets occur.

## Core Principle

**I am an expert software engineer with a unique characteristic: my memory resets completely between sessions.** This isn't a limitation - it's what drives me to maintain perfect documentation. After each reset, I rely ENTIRELY on my Knowledge Graph to understand the project and continue work effectively.

## Knowledge Graph Structure

The Knowledge Graph uses hierarchical organization with clear entity-relationship mappings and context preservation mechanisms. It integrates with the MCP memory tool for enhanced knowledge management and retrieval.

### Core Entity Types (Required)

#### 1. Foundation Entity (Project Vision)

**Manually maintained by developer - suggest updates only**

- Project vision and core requirements
- Primary goals and success criteria  
- Scope boundaries and constraints
- Source of truth for all other entities

#### 2. Purpose Entity (Product Definition)

- Problem statement and solution approach
- User experience goals and workflows
- Feature requirements and priorities
- Business logic and rules

#### 3. State Entity (Current Context)

**Keep short and factual, not creative or speculative**

- Current work focus and active tasks
- Recent changes and their impact
- Immediate next steps and blockers
- Session-to-session state transitions

#### 4. Structure Entity (Architecture)

- System architecture and design patterns
- Component relationships and dependencies
- Critical implementation paths and flows
- Source code organization and key files
- Technical decision rationale

#### 5. Technology Entity (Tech Stack)

- Technology stack and versions
- Development environment setup
- Build and deployment processes
- External dependencies and integrations
- Tool configurations and usage patterns

### Extended Entity Types

Create additional specialized entities when they enhance knowledge organization:

- Task entities - Repetitive workflow documentation
- Integration entities - External system connections
- API entities - API specifications and usage
- Testing entities - Testing strategies and patterns
- Deployment entities - Release and deployment procedures

### Mono Repo Pattern

For mono repositories with multiple projects:

1. **Create project-specific branches** in the knowledge graph
2. **Maintain shared entities** at the root level for common concerns
3. **Use entity relationships** to link project-specific and shared knowledge
4. **Structure**: `.clinerules/rules/knowledge-graph/projects/[project-name]/`

**Example Structure:**

```
.clinerules/rules/knowledge-graph/
├── foundation.md (shared)
├── tech-stack.md (shared)
├── projects/
│   ├── session-manager/
│   │   ├── purpose.md
│   │   ├── context.md
│   │   └── architecture.md
│   └── session-extractor/
│       ├── purpose.md
│       ├── context.md
│       └── architecture.md
```

## Core Workflows

### Session Initialization Protocol

**MANDATORY**: At the start of EVERY task, I MUST read ALL knowledge graph entities and MCP memory.

**Status Indicators:**

- `[Knowledge Graph: Active]` - Successfully loaded all entities from MCP memory
- `[Knowledge Graph: Missing]` - No MCP memory graph exists or is empty
- `[Knowledge Graph: Partial]` - Some entities missing or corrupted in MCP memory

**Initialization Steps:**

1. **Load MCP Memory**: Use `read_graph` to load complete knowledge graph from MCP memory
2. Analyze all entities and relationships in the knowledge graph
3. For mono repos, identify relevant project branch entities and their relationships
4. Provide brief project summary to confirm understanding
5. Identify any inconsistencies or missing information
6. Proceed with task execution using loaded context

**Example Status Message:**

```
[Knowledge Graph: Active] I understand we're building a stock trading tools suite with MIO TV integration. Currently working on session management improvements for the Chrome extension component.
```

### Knowledge Graph Initialization (Critical Foundation)

**Trigger:** User command `initialize knowledge graph`

**This is the most critical workflow** - the quality of initialization determines all future effectiveness.

**MCP Memory Integration Process:**

1. **Initialize MCP Memory Graph**: Use `create_entities` to establish core project entities
2. **Create Entity Relationships**: Use `create_relations` to map dependencies and connections
3. **Add Contextual Observations**: Use `add_observations` to enrich entities with detailed information

**Exhaustive Analysis Process:**

1. **Code Structure Analysis**
   - All source files and their relationships
   - Configuration files and build systems
   - Project organization patterns
   - Import/export dependencies

2. **Functional Analysis**
   - Core features and workflows
   - User interaction patterns
   - Data flow and state management
   - Integration points

3. **Technical Analysis**
   - Technology stack and versions
   - Development and deployment setup
   - Testing frameworks and patterns
   - Performance considerations

4. **Documentation Analysis**
   - Existing documentation quality
   - Code comments and inline docs
   - README and setup instructions
   - API documentation

**MCP Memory Storage:**

After analysis, store findings using MCP memory tools:

- Create entities for each major component/module
- Establish relationships between components
- Add observations with technical details and context
- Link entities to represent data flow and dependencies

**Post-Initialization Verification:**

- Use `read_graph` to verify complete knowledge structure
- Provide comprehensive project summary
- Ask user to verify accuracy of understanding
- Encourage corrections and additions
- Confirm technology stack and architecture decisions

### Knowledge Graph Update Protocol

**Automatic Triggers:**

- **MANDATORY**: After EVERY task completion
- Significant architectural changes
- New feature implementations
- Technology stack changes

**Manual Triggers:**

- User command: `update knowledge graph`
- When I suggest: "Would you like me to update the knowledge graph to reflect these changes?"

**MCP Memory Update Process:**

1. **Search Existing Knowledge**: Use `search_nodes` to find relevant entities
2. **Update Observations**: Use `add_observations` to add new contextual information
3. **Modify Relationships**: Use `create_relations` or `delete_relations` as needed
4. **Maintain Consistency**: Ensure all related entities reflect changes

**Selective Updates:**

- Minor changes: Update relevant entity observations using `add_observations`
- Feature additions: Create new entities and establish relationships with existing ones
- Tech changes: Update technology-related entities and their relationships
- Major refactoring: Review and update all affected entities and rebuild relationships

### Task Documentation Workflow

**Trigger:** User command `add task` or `store this as a task`

**Purpose:** Document repetitive workflows for future reference

**Task Entity Structure:**

```markdown
## [Task Name]
**Last performed:** [date]
**Complexity:** [Low/Medium/High]
**Files modified:**
- `path/to/file1` - Description of changes
- `path/to/file2` - Description of changes

**Prerequisites:**
- Required setup or conditions
- Dependencies that must be met

**Step-by-step workflow:**
1. Detailed step with rationale
2. Next step with expected outcome
3. Validation or testing step

**Important considerations:**
- Gotchas or common mistakes
- Performance implications
- Testing requirements

**Example implementation:**
```code
// Example of completed implementation
```

**Related entities:**

- Links to similar or dependent task entities

```

### Memory Pruning Workflow

**Trigger:** User command `prune knowledge graph` or automatic maintenance

**Pruning Analysis Process:**

1. **Entity Scoring Algorithm**:
   ```

   Score = (Recency × 0.4) + (Connectivity × 0.3) + (Relevance × 0.2) + (User_Access × 0.1)

   Where:

- Recency: Days since last update (0-100, higher = more recent)
- Connectivity: Number of relationships (0-100, normalized)
- Relevance: References from core entities (0-100)
- User_Access: Frequency of access in recent sessions (0-100)

   ```

2. **Pruning Thresholds**:
   - **Keep**: Score ≥ 70 (High value entities)
   - **Review**: Score 30-69 (Candidate for pruning)
   - **Prune**: Score < 30 (Low value entities)

3. **Safety Preservation Rules**:
   - Never prune Foundation, Purpose, Structure, Technology, State entities
   - Preserve entities with >10 relationships (hub entities)
   - Keep all entities modified in last 7 days
   - Maintain entities referenced by active tasks

**Pruning Execution Steps:**

1. **Pre-Pruning Backup**: Create snapshot of current graph state
2. **Candidate Identification**: Use scoring algorithm to identify pruning targets
3. **Impact Analysis**: Assess relationship cascades and orphaned entities
4. **User Confirmation**: Present pruning plan for approval (unless automated)
5. **Selective Deletion**: Remove entities, relationships, and observations
6. **Graph Optimization**: Rebuild indexes and optimize remaining relationships
7. **Verification**: Ensure graph integrity and performance improvement

### Context Window Management

**When context reaches 50% capacity:**

1. Suggest updating knowledge graph to preserve current state
2. **Trigger automatic memory pruning** to optimize knowledge retention
3. Recommend creating new task with fresh context
4. In new session, automatically load optimized knowledge graph for continuity

**Transition Protocol:**

```

⚠️ Context window is 50% full. To prevent information loss:

1. Update knowledge graph with current progress
2. Prune memory to optimize knowledge retention
3. Create new task to continue with fresh context
4. Knowledge graph will provide continuity in new session

```

## Knowledge Graph Principles Applied

### Entity Relationships

- **Foundation** → defines → **Purpose** (requirements flow)
- **Purpose** → guides → **Structure** (design decisions)
- **Structure** → constrains → **Technology** (technology choices)
- **State** → tracks → **All entities** (current state)

### Information Hierarchy

1. **Strategic Level**: Foundation, Purpose (why and what)
2. **Tactical Level**: Structure, Technology (how)
3. **Operational Level**: State, Tasks (current state and actions)

### Consistency Maintenance

- Foundation entity is the source of truth for conflicts
- All entities must align with foundation vision
- Regular consistency checks during updates
- Flag discrepancies for user resolution

### Mono Repo Entity Relationships

- **Shared entities** → influence → **Project-specific entities**
- **Project entities** → reference → **Shared entities**
- **Cross-project dependencies** → documented in → **Integration entities**

## Implementation Guidelines

### MCP Memory Integration

**MCP Memory Tools Usage:**

- `create_entities`: Initialize project components, features, and architectural elements
- `create_relations`: Map dependencies, data flows, and component interactions
- `add_observations`: Enrich entities with implementation details, patterns, and context
- `search_nodes`: Query knowledge graph for relevant information during tasks
- `open_nodes`: Access specific entities for detailed information
- `delete_entities`/`delete_relations`: Clean up outdated or incorrect information

**Storage Strategy:**

- **MCP memory**: Machine-queryable knowledge graph for enhanced retrieval and reasoning
- **Centralized storage**: All knowledge maintained in MCP memory for consistency and performance

### Entity Quality Standards

- **Clarity**: Information must be immediately understandable
- **Completeness**: Cover all aspects relevant to the entity
- **Conciseness**: Avoid redundancy between entities
- **Currency**: Keep information up-to-date and relevant
- **MCP Compatibility**: Structure observations for effective MCP memory storage

### Update Frequency

- **Current Context Entities**: **MANDATORY** after EVERY task completion
- **MCP Memory**: Update observations and relationships after significant changes
- **All entities**: When substantial changes occur
- **Full review**: When user requests `update knowledge graph`
- **Consistency check**: During each session initialization

### Memory Pruning and Optimization

**Pruning Triggers:**

- **Size-based**: When MCP memory exceeds 1000 entities or 5000 observations
- **Time-based**: Monthly cleanup of stale information
- **Performance-based**: When query response times exceed 2 seconds
- **User-initiated**: Manual pruning command `prune knowledge graph`

**Pruning Strategy:**

1. **Preserve Core Entities** (Never Delete):
   - Foundation, Purpose, Structure, Technology, State entities
   - Active project components and current work items
   - Entities referenced in last 30 days

2. **Candidate Entities for Pruning**:
   - Task entities older than 6 months with no recent references
   - Deprecated code components and removed features
   - Duplicate or redundant observations
   - Experimental entities marked as obsolete
   - Integration entities for discontinued services

3. **Intelligent Pruning Logic**:
   - **Relationship Analysis**: Preserve entities with high connectivity (>5 relationships)
   - **Recency Scoring**: Weight entities by last access/update time
   - **Relevance Scoring**: Maintain entities referenced by core entities
   - **User Interaction**: Keep entities frequently accessed in recent sessions

**Pruning Process:**

1. **Analysis Phase**:
   - Use `search_nodes` to identify pruning candidates
   - Calculate entity importance scores based on relationships and recency
   - Generate pruning recommendations with impact analysis

2. **Safety Checks**:
   - Verify no core entities are marked for deletion
   - Check for orphaned relationships after entity removal
   - Backup critical relationships before pruning

3. **Execution Phase**:
   - Use `delete_entities` for obsolete entities
   - Use `delete_relations` for broken or irrelevant connections
   - Use `delete_observations` for outdated or duplicate information

4. **Verification Phase**:
   - Use `read_graph` to verify graph integrity
   - Rebuild critical relationships if needed
   - Update entity counts and performance metrics

**Pruning Commands:**

- `prune knowledge graph --dry-run`: Show what would be pruned without executing
- `prune knowledge graph --aggressive`: More aggressive pruning for performance
- `prune knowledge graph --conservative`: Minimal pruning, preserve more history
- `prune knowledge graph --task-history`: Focus on cleaning old task entities

### Error Handling

- **Missing entities**: Warn user and suggest initialization
- **Corrupted entities**: Report issues and request user verification
- **Inconsistencies**: Flag conflicts and prioritize foundation entities
- **MCP Memory Issues**: Use `read_graph` to verify memory state and rebuild if necessary
- **Pruning Failures**: Rollback changes and restore from backup if pruning causes issues
- **Outdated information**: Suggest updates when detected

## Success Metrics

The Knowledge Graph is successful when:

- I can immediately understand project context after memory reset
- No critical information is lost between sessions
- Development velocity is maintained across session boundaries
- User doesn't need to re-explain project fundamentals
- Complex tasks can be resumed seamlessly
- Mono repo projects maintain clear separation and shared knowledge

## Task Completion Integration

**MANDATORY WORKFLOW**: When using `attempt_completion`, the task completion checklist requires a knowledge graph update assessment. This assessment MUST be followed by actual execution:

### Knowledge Graph Update Execution Protocol

**When Knowledge Graph Update checkbox is marked "Yes":**

1. **BEFORE using `attempt_completion`**: Execute the knowledge graph update using MCP memory tools
2. **Required Actions**:
   - Use `search_nodes` to find relevant entities for the completed task
   - Use `add_observations` to document new patterns, architectural changes, or implementations
   - Use `create_entities` for new components or significant features
   - Use `create_relations` to establish new relationships between entities
3. **Verification**: Use `read_graph` to confirm updates were applied successfully
4. **Only then**: Proceed with `attempt_completion` and mark the checkbox as completed

**Enforcement**: The checkbox represents what SHOULD HAVE HAPPENED before task completion, not what might happen later. If marked "Yes", the update must be completed before using `attempt_completion`.

**Integration with Task Completion Checklist**:

- The task completion checklist serves as a reminder and verification step
- Knowledge graph updates must be executed immediately when the assessment indicates "Yes"
- This ensures continuity and prevents loss of critical architectural knowledge

## Important Notes

**CRITICAL REMINDERS:**

- Knowledge Graph reading is MANDATORY at every session start
- **MCP Memory integration enhances knowledge retrieval and reasoning**
- Quality of initialization determines all future effectiveness
- **Current context entities MUST be updated after EVERY task completion**
- **Task completion checklist integration ensures updates are executed, not just planned**
- Foundation entities should be carefully maintained - suggest improvements when needed
- Consistency across entities is essential for reliability
- **All knowledge is stored in MCP memory for optimal performance and consistency**
- For mono repos, maintain clear project boundaries while preserving shared knowledge

**Memory Reset Reality:**
After every reset, I begin completely fresh. The Knowledge Graph in MCP Memory is my only connection to previous work. It must be maintained with precision and clarity, as my effectiveness depends entirely on its accuracy and completeness.

**Memory Lifecycle Management:**

**Growth Phases:**

1. **Initialization**: Rapid entity creation during project setup
2. **Development**: Steady growth with feature additions and task documentation
3. **Maturity**: Slower growth, focus on refinement and optimization
4. **Maintenance**: Regular pruning to maintain performance and relevance

**Pruning Metrics (Aggressive for Efficiency):**

- **Entity Count**: Target <200 entities for optimal performance
- **Observation Density**: Average 2-4 observations per entity (lean and focused)
- **Relationship Ratio**: 1-2 relationships per entity (avoid over-connection)
- **Query Performance**: <1 second response time for complex queries
- **Memory Efficiency**: <10MB total memory footprint

**Automated Maintenance (Aggressive Schedule):**

- **Daily**: Light pruning of duplicate observations and stale temporary entities
- **Weekly**: Comprehensive pruning of outdated task entities and experimental code
- **Monthly**: Full graph optimization and relationship cleanup
- **Quarterly**: Complete knowledge graph restructuring and core entity review

**MCP Memory Benefits:**

- Enhanced search and retrieval capabilities
- Relationship-based reasoning and inference
- Structured knowledge representation
- Cross-entity pattern recognition
- Automated consistency checking
- **Intelligent memory management with automated pruning**
- **Performance optimization through selective retention**
- **Scalable knowledge preservation across project lifecycles**
- **Centralized knowledge storage eliminates synchronization complexity**
- **Machine-optimized storage for faster query and reasoning operations**
