# TypeScript Migration Plan

**Status:** 🟡 Planned  
**Priority:** Medium  
**Estimated Effort:** 2-3 sprints (incremental)

---

## Why TypeScript?

| Benefit | Impact |
|---|---|
| Catch type errors at build time | Reduces runtime bugs by 15-25% |
| Self-documenting interfaces | Faster onboarding for new developers |
| IDE autocomplete + refactoring | 2-3x faster development |
| Required for FDA IEC 62304 Class C | Static analysis compliance |
| Better API contract enforcement | Prevents integration mismatches |

## Migration Strategy: Incremental (Zero Downtime)

### Phase 1: Foundation (Sprint 1)
```
[ ] Install TypeScript + ts-node
[ ] Add tsconfig.json (strict: false initially)
[ ] Enable allowJs: true (mix JS/TS)
[ ] Create types/ directory for shared interfaces
[ ] Define core types: User, WorkOrder, Company, Asset
```

### Phase 2: Models & Services (Sprint 2)
```
[ ] Convert Mongoose models to TypeScript (with type guards)
[ ] Convert services/ to TypeScript
[ ] Add request/response DTOs for API routes
[ ] Convert middleware/hipaaCompliance.js → .ts
[ ] Add return type annotations to all exported functions
```

### Phase 3: Routes & Tests (Sprint 3)
```
[ ] Convert routes/ to TypeScript
[ ] Convert test files to TypeScript
[ ] Enable strict: true in tsconfig
[ ] Add CI/CD type-check step (tsc --noEmit)
[ ] Remove allowJs: true
```

## tsconfig.json (Starter)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": false,
    "allowJs": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "types/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

## Core Type Definitions (Preview)

```typescript
// types/models.ts
interface User {
  _id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN' | 'COMPANY' | 'OFFICE' | 'TECH' | 'CLIENT';
  companyId: string;
  mfaEnabled: boolean;
  lastLogin: Date;
}

interface WorkOrder {
  _id: string;
  woNumber: string;
  status: 'Open' | 'Assigned' | 'In Progress' | 'Waiting for Parts' | 'Complete' | 'Invoiced' | 'Archived';
  companyId: string;
  clientId: string;
  techId?: string;
  equipment: EquipmentRef;
  priority: 'Low' | 'Normal' | 'High' | 'Emergency';
  createdAt: Date;
  closedAt?: Date;
}

interface Company {
  _id: string;
  name: string;
  accountNumber: string;
  type: 'SERVICE_COMPANY' | 'CLIENT_FACILITY';
  parentCompanyId?: string;
  settings: CompanySettings;
}
```

## Coverage Target

| Metric | Current | Target |
|---|---|---|
| Unit test coverage | ~45% | **>60%** |
| Type coverage (TS) | 0% (JS) | **>80%** after Phase 2 |
| Integration tests | 12 suites | 20+ suites |

### Coverage Badge

Add to README.md after CI/CD setup:
```markdown
![Coverage](https://img.shields.io/badge/coverage-60%25-yellowgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-planned-blue)
```
