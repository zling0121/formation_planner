# FormationFlow

**An intelligent formation planning platform for student choreographers**

FormationFlow helps dance teams design, validate, and learn stage formation transitions through path visualization, conflict detection, and constraint-based optimization.

---

## 📋 Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Live Demo](#live-demo)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Key Decisions](#key-decisions)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Overview

**FormationFlow** is a web-based tool that helps student choreographers and dance captains design, evaluate, and communicate stage formation transitions. 

Unlike generic drawing tools, FormationFlow:
- **Visualizes** dancer movement paths between formations
- **Detects** safety conflicts and proximity issues
- **Recommends** optimized position assignments
- **Shares** read-only views with team members

Target users: **Student choreographers managing 6-20 person dance teams.**

---

## The Problem

Choreographers face four intertwined challenges:

| Challenge | Description |
|-----------|-------------|
| **Spatial** | Where should each dancer stand? |
| **Path** | How does each person move to their next position? |
| **Conflict** | Will dancers collide or cross paths? |
| **Communication** | How does every dancer understand their route? |

**Current workarounds** (paper, whiteboards, PowerPoint, video) are time-consuming and don't address path conflicts or team communication.

**FormationFlow solves this** by treating formation planning as a spatial optimization problem, not just a drawing exercise.

---

## Features

### ✅ MVP Features (Implemented)

| Feature | Description |
|---------|-------------|
| **Dancer Management** | Add, name, and manage 6-16 dancers with unique IDs |
| **Two-Formation Editor** | Create and switch between Formation A and Formation B |
| **Drag & Drop Stage** | Position dancers on a 2D stage with mouse/touch support |
| **Transition Playback** | Animate straight-line movement between formations |
| **Safety Detection** | Calculate minimum separation distance between all dancer pairs |
| **Conflict Visualization** | Highlight unsafe paths and conflict locations |
| **Travel Metrics** | Display total distance, longest individual distance, affected dancers |
| **Optimization Engine** | Recommend target-position swaps to reduce conflicts |
| **Lock/Unlock** | Prevent specific dancers from being reassigned |
| **Preview & Accept** | Preview recommendations before applying |
| **Undo/Redo** | Revert or re-apply accepted recommendations |
| **Local Storage** | Auto-save projects in browser |
| **Export/Import** | Save and load projects as JSON |
| **Read-Only Sharing** | Share formation plans with team members |
| **Sample Project** | Immediate exploration without setup |

### ❌ Explicitly Excluded (MVP)

- Video analysis / motion capture
- Automatic choreography generation
- 3D stages or VR
- Real-time collaboration
- Music editing or beat detection
- Social features or community
- AI choreography chatbot

---

## Tech Stack

| Category | Technology | Rationale |
|----------|------------|-----------|
| **Framework** | Next.js 15 (React 19) | App router, performance, deployment |
| **Language** | TypeScript (strict mode) | Type safety, better Codex collaboration |
| **Styling** | Tailwind CSS | Rapid UI development |
| **Graphics** | SVG | Native drag support, easy path drawing, exportable |
| **Testing** | Vitest + Playwright | Unit + E2E coverage |
| **Package Manager** | pnpm | Fast, disk-efficient |
| **Linting** | ESLint | Code quality |
| **Formatting** | Prettier | Consistent style |
| **State** | React Context / Zustand | Simple, predictable state |
| **Geometry** | Pure TypeScript | No dependencies for safety calculations |

---

## Live Demo

- **Demo Video:** [https://youtu.be/your-video-id](https://youtu.be/your-video-id)
- **GitHub:** [https://github.com/zling0121/formation_planner](https://github.com/zling0121/formation_planner)

---

## Installation

### Prerequisites
- Node.js 18+
- pnpm 8+

### Setup

```bash
# Clone the repository
git clone https://github.com/zling0121/formation_planner.git
cd formation_planner

# Install dependencies
pnpm install

# Start development server
pnpm dev

# Open http://localhost:3000
```

---

## Usage

### Quick Start (30 seconds)

1. **Open the app** → Sample project loads automatically
2. **Switch formations** using the A/B toggle at bottom
3. **Drag dancers** to create Formation A and Formation B
4. **Click Play** to watch the transition animation
5. **View analysis panel** to see conflicts and metrics
6. **Review recommendations** if conflicts are detected
7. **Accept or reject** recommended position swaps

### Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm start` | Production server |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run E2E tests |
| `pnpm lint` | Check code quality |
| `pnpm format` | Format code |

### Key Workflow

```
1. Create Formation A → 2. Create Formation B → 3. Play transition
         ↓
4. Detect conflicts → 5. Review recommendations → 6. Accept/Reject
         ↓
7. Share with team → 8. Team members view their routes
```

---

## Project Structure

```
formation_planner/
├── app/                          # Next.js app router
│   ├── page.tsx                 # Home page
│   ├── layout.tsx               # Root layout
│   └── globals.css              # Global styles
├── components/                   # React components
│   ├── editor/
│   │   ├── Stage.tsx            # SVG stage with drag
│   │   ├── Dancer.tsx           # Individual dancer component
│   │   ├── FormationControls.tsx # A/B switching
│   │   └── Timeline.tsx         # Playback controls
│   ├── analysis/
│   │   ├── AnalysisPanel.tsx    # Conflict display
│   │   ├── ConflictList.tsx     # List of detected issues
│   │   └── PathVisualization.tsx # Path drawing
│   ├── optimization/
│   │   ├── RecommendationPanel.tsx
│   │   ├── PreviewButton.tsx
│   │   └── AcceptRejectControls.tsx
│   └── shared/
│       ├── Navigation.tsx
│       ├── DancerList.tsx
│       └── ShareButton.tsx
├── src/                          # Business logic
│   ├── types/
│   │   └── index.ts             # All TypeScript types
│   ├── lib/
│   │   ├── geometry/
│   │   │   ├── coordinates.ts   # Normalized coordinate utilities
│   │   │   ├── safety.ts        # Collision detection engine
│   │   │   └── optimization.ts  # Recommendation engine
│   │   ├── storage/
│   │   │   ├── localStorage.ts  # Save/restore
│   │   │   └── validation.ts    # Data validation
│   │   └── analytics/
│   │       └── events.ts        # Event specifications
│   ├── hooks/
│   │   ├── useStage.ts          # Stage state management
│   │   ├── useTransition.ts     # Animation state
│   │   └── useRecommendations.ts # Optimization state
│   └── constants/
│       └── index.ts             # Default values, thresholds
├── e2e/                          # Playwright tests
│   ├── editor.spec.ts
│   ├── transition.spec.ts
│   └── sharing.spec.ts
├── public/                       # Static assets
├── work/                         # Research and planning
│   ├── research/
│   │   └── interview-notes.md   # User research findings
│   ├── PRODUCT_SPEC.md          # Product requirements
│   ├── DECISIONS.md             # Technical decisions
│   ├── AGENTS.md                # Codex instructions
│   ├── SAFETY_ENGINE.md         # Algorithm documentation
│   ├── OPTIMIZATION_ENGINE.md   # Optimization approach
│   ├── DATA_FORMAT.md           # Data schema
│   └── SETUP.md                 # Setup guide
├── .next/                        # Next.js build (generated)
├── node_modules/                 # Dependencies
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── tailwind.config.ts
├── eslint.config.mjs
└── README.md                     # This file
```

---

## Key Decisions

### 1. SVG Over Canvas/WebGL
**Decision:** Use SVG for the stage editor  
**Rationale:** Easier drag-and-drop, native path rendering, simpler export, sufficient for 6-20 dancers

### 2. Normalized Coordinates (0-1)
**Decision:** Store positions normalized, convert to screen pixels  
**Rationale:** Stage resizing doesn't break positions, algorithm works at any scale

### 3. Deterministic Safety Engine
**Decision:** Pure mathematical collision detection, not ML/LLM  
**Rationale:** Verifiable, testable, no hallucinations, faster, fits MVP

### 4. Lexicographic Ranking for Recommendations
**Decision:** Prioritize: conflicts > boundary violations > speed > intersections > distance  
**Rationale:** Safety first, then aesthetics, no arbitrary weights

### 5. Local Storage First
**Decision:** No database in MVP  
**Rationale:** Faster development, no auth complexity, validates product value first

### 6. Two Formations Only
**Decision:** Formation A and B only, no timeline  
**Rationale:** Validates core value proposition (transition optimization) before complexity

### 7. Recommendations, Not Automation
**Decision:** Always preview and require acceptance  
**Rationale:** Preserves choreographer's artistic control, builds trust

---

## Testing

### Unit Tests (Vitest)
```bash
pnpm test
```

**Coverage includes:**
- Coordinate conversions
- Safety engine edge cases
- Optimization ranking
- Data validation
- Storage serialization

### End-to-End Tests (Playwright)
```bash
pnpm test:e2e          # Headless
pnpm test:e2e -- --headed  # With browser
```

**Critical paths tested:**
- Dragging dancers within bounds
- Switching between formations
- Transition playback
- Conflict detection display
- Recommendation acceptance workflow
- Share link opening

---

## Deployment

### Vercel (Recommended)

```bash
# Push to GitHub
git push origin main

# Import repository to Vercel
# Deploy automatically on push
```

### Manual Build
```bash
pnpm build
pnpm start
```

### Environment Variables
```env
# No environment variables required for MVP
# Add if deploying with analytics
NEXT_PUBLIC_ANALYTICS_ID=your_id
```

---

## User Research Findings

Based on interviews with 8 student choreographers:

**Key Insights:**
- ✅ Formation transitions are a real pain point (average 15-20 min per transition)
- ✅ Version confusion is more common than expected (3+ revisions per routine)
- ✅ Choreographers want to share plans but lack good tools
- ⚠️ Collision detection is valuable but not the top concern (remembering positions is #1)
- ⚠️ Digital tools must be faster than paper (or they won't be adopted)

**MVP Adjustments:**
- Prioritized clear individual route visualization
- Added sharing to reduce version confusion
- Made dragging as efficient as possible
- Kept collision detection as differentiator

---

## Product Metrics

### Primary Metrics
- **Task completion time** (create 2 formations + transition)
- **Conflict detection rate** (how many issues found)
- **Recommendation acceptance rate**
- **Share link open rate**

### Secondary Metrics
- Total travel distance reduction
- User satisfaction score
- Feature usage frequency

---

## Acknowledgments

- Student choreographers who participated in user research
- Dance captains who tested the MVP
- [Any mentors or advisors]

---

## Quick Setup Commands

```bash
# Clone & Install
git clone https://github.com/zling0121/formation_planner.git
cd formation_planner
pnpm install

# Run
pnpm dev

# Test
pnpm test

# Build
pnpm build
```

---

**This README follows the product-first approach outlined in the product document. All features are aligned with the MVP scope, and technical decisions are documented with their rationale.**
