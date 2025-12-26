# V2 Project View Sandbox Recovery Refactoring Plan

## Overview

Refactor `src/modules/projects/ui/view/v2-project-view.tsx` to eliminate redundant sandbox recovery logic, fix infinite re-render loops, and simplify state management by trusting the well-designed `useSandboxHealthV2` hook.

## Current State Analysis

The v2-project-view component suffers from multiple overlapping concerns and redundant recovery mechanisms that conflict with the `useSandboxHealthV2` hook's sophisticated built-in recovery system.

### Key Problems Identified:

- **Redundant Recovery Logic**: Component duplicates health monitoring at lines 196-208 and 403-419 that the hook already handles
- **Callback Dependency Cascades**: `handleHealthChange` at line 81 depends on `[sandboxUrl]` causing re-render loops
- **State Duplication**: Component manages `stableRecoveryState` when hook provides `isRecovering`
- **Over-complicated Dependencies**: Multiple useEffect hooks with problematic dependency arrays (lines 208, 352, 419)
- **Manual Health Orchestration**: Component tries to manage what the hook is designed to handle automatically

### What We're NOT Doing

- Modifying the `useSandboxHealthV2` hook (it's well-designed)
- Changing tRPC procedures or backend logic
- Altering the overall component structure or props interface
- Modifying fragment loading mutations or V2FragmentsList component

## Implementation Approach

Trust the `useSandboxHealthV2` hook's design and create a thin presentation layer that reacts to hook state rather than trying to orchestrate complex recovery flows.

## Phase 1: Remove Redundant Recovery Logic

### Overview
Eliminate manual health checking, window focus handling, and debounced recovery triggers that duplicate hook functionality.

### Changes Required:

#### 1. Remove Manual Health Monitoring Effects
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Remove**: 196-208, 403-419

Remove these redundant effects:
```typescript
// REMOVE: Manual health monitoring (lines 196-208)
useEffect(() => {
  const hasFiles = sandboxFiles && Object.keys(sandboxFiles).length > 0;
  if (hasFiles && needsInitialization && !isRecovering) {
    console.log("[V2ProjectView] Files detected, refreshing health check...");
    const timeoutId = setTimeout(() => {
      checkSandboxHealth();
    }, 2000);
    return () => clearTimeout(timeoutId);
  }
}, [sandboxFiles, needsInitialization, isRecovering]);

// REMOVE: Window focus health checks (lines 403-419)
useEffect(() => {
  const handleWindowFocus = () => {
    console.log("[V2ProjectView] Window gained focus - triggering health check");
    setTimeout(() => {
      checkSandboxHealth();
    }, 500);
  };
  window.addEventListener("focus", handleWindowFocus);
  return () => {
    window.removeEventListener("focus", handleWindowFocus);
  };
}, [checkSandboxHealth]);
```

#### 2. Remove Manual Health Check Triggers
**File**: `src/modules/projects/ui/view/v2-project-view.tsx` 
**Lines to Modify**: 210-216, 342-352

Remove these manual trigger effects:
```typescript
// REMOVE: Manual refetch after recovery (lines 210-216)
useEffect(() => {
  if (hasActiveSandbox && isHealthy && !isRecovering) {
    console.log("[V2ProjectView] Sandbox became healthy - fetching files");
    refetchSandboxFiles();
  }
}, [hasActiveSandbox, isHealthy, isRecovering, refetchSandboxFiles]);

// REMOVE: Manual initial health check (lines 342-352)
useEffect(() => {
  if (!hasTriggeredInitialHealthCheck) {
    console.log("[V2ProjectView] Triggering initial health check");
    setHasTriggeredInitialHealthCheck(true);
    setTimeout(() => {
      checkSandboxHealth();
    }, 100);
  }
}, [hasTriggeredInitialHealthCheck]);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `pnpm build`
- [ ] No linting errors: `pnpm lint`
- [ ] Component renders without console errors

#### Manual Verification:
- [ ] Sandbox recovery still works when manually triggered
- [ ] No redundant health check API calls in network tab
- [ ] Page focus/blur behavior relies on hook only

---

## Phase 2: Simplify State and Callbacks

### Overview
Eliminate state duplication and fix callback dependencies that cause re-render cascades.

### Changes Required:

#### 1. Remove Redundant State Variables
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Remove/Modify**: 70-72, 322

Remove these state variables:
```typescript
// REMOVE: Redundant recovery state
const [hasTriggeredInitialHealthCheck, setHasTriggeredInitialHealthCheck] = useState(false);
const [stableRecoveryState, setStableRecoveryState] = useState(false);
```

#### 2. Simplify Health Change Callback
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Replace**: 81-102

Replace problematic callback:
```typescript
// REPLACE: Remove sandboxUrl dependency
const handleHealthChange = useCallback(
  (healthy: boolean, details: any) => {
    console.log("[V2ProjectView] Health change:", {
      healthy,
      details: {
        sandboxUrl: details?.sandboxUrl,
        sandboxId: details?.sandboxId,
        needsRefresh: details?.needsRefresh,
      },
    });
    
    // Simply set sandbox URL without dependency check
    if (details?.sandboxUrl) {
      setSandboxUrl(details.sandboxUrl);
    }
  },
  [] // Remove all dependencies
);
```

#### 3. Simplify UI State Computation
**File**: `src/modules/projects/ui/view/v2-project-view.tsx**
**Lines to Replace**: 284-314

Replace complex UI state logic:
```typescript
// REPLACE: Simplified UI state using only hook state
const uiState = useMemo(() => {
  if (isRecovering) return "recovering";
  if (isLoadingFirstFragment) return "loadingFragment";
  if (isHealthLoading) return "checkingHealth";
  if (sandboxUrl && isHealthy && hasActiveSandbox) return "ready";
  if (needsRefresh) return "needsRefresh";
  if (needsInitialization) return "needsInitialization";
  if (hasActiveSandbox) return "sandboxNotReady";
  return isNewProject ? "newProject" : "noPreview";
}, [
  isRecovering,
  isLoadingFirstFragment, 
  isHealthLoading,
  sandboxUrl,
  isHealthy,
  hasActiveSandbox,
  needsRefresh,
  needsInitialization,
  isNewProject,
]);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `pnpm build`
- [ ] No linting errors: `pnpm lint`
- [ ] React DevTools shows fewer re-renders

#### Manual Verification:
- [ ] UI state transitions work correctly
- [ ] Sandbox URL updates properly when health changes
- [ ] No visible UI flickering during state changes

---

## Phase 3: Streamline Effects

### Overview
Reduce from 9 useEffect hooks to 3-4 focused ones with proper dependencies.

### Changes Required:

#### 1. Consolidate Project Reset Effect
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Replace**: 316-340

Replace with simplified reset logic:
```typescript
// REPLACE: Simplified project change effect
useEffect(() => {
  console.log("[V2ProjectView] Project changed, resetting state:", projectId);
  setLoadedFragment(null);
  setSandboxUrl("");
  
  // Only invalidate project-related queries
  queryClient.invalidateQueries({
    predicate: (query) => {
      const queryKey = query.queryKey;
      return (
        Array.isArray(queryKey) &&
        queryKey.some(
          (key) =>
            typeof key === "object" &&
            key !== null &&
            "projectId" in key &&
            (key as any).projectId === projectId
        )
      );
    },
  });
}, [projectId, queryClient]);
```

#### 2. Simplify Sandbox URL Update Effect  
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Replace**: 354-361

Replace with stable effect:
```typescript
// REPLACE: Simple sandbox URL effect
useEffect(() => {
  if (healthSandboxUrl) {
    setSandboxUrl(healthSandboxUrl);
    setIsLoadingFirstFragment(false);
  }
}, [healthSandboxUrl]);
```

#### 3. Remove Redundant Recovery State Management
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Remove**: 370-387

Remove the complex recovery state management effect entirely.

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `pnpm build`
- [ ] No linting errors: `pnpm lint`
- [ ] Reduced useEffect count (from 9 to ~3-4)

#### Manual Verification:
- [ ] Project switching still resets state properly
- [ ] Sandbox URL updates correctly
- [ ] No useEffect dependency warnings in console

---

## Phase 4: Optimize Queries and File Loading

### Overview
Simplify file loading logic and remove conditional complexity that conflicts with hook state.

### Changes Required:

#### 1. Simplify Query Enabling Logic
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Replace**: 144, 154

Replace complex conditional logic:
```typescript
// REPLACE: Simplified query enabling
const queryEnabled = hasActiveSandbox && isHealthy;

const {
  data: sandboxFiles,
  refetch: refetchSandboxFiles,
  isLoading: isLoadingSandboxFiles,
  error: sandboxFilesError,
} = useQuery({
  ...trpc.projects.getAllSandboxFilesWithContent.queryOptions({ projectId }),
  enabled: queryEnabled && !!projectId,
  retry: (failureCount: number, error: any) => {
    // Keep existing retry logic
    if (
      error?.data?.code === "FORBIDDEN" ||
      error?.data?.code === "NOT_FOUND"
    ) {
      return false;
    }
    return failureCount < 2;
  },
  staleTime: 180000, // Keep long cache
  gcTime: 600000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
});
```

#### 2. Remove File Loading Monitoring Effect
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Remove**: 175-193

Remove the file loading monitoring effect since the hook handles this.

#### 3. Simplify Fragment Auto-Loading
**File**: `src/modules/projects/ui/view/v2-project-view.tsx`
**Lines to Replace**: 421-460

Replace with simplified auto-loading logic:
```typescript
// REPLACE: Simplified auto-loading effect
useEffect(() => {
  if (
    isHealthy &&
    hasActiveSandbox &&
    activeFragmentId &&
    (!loadedFragment || loadedFragment.id !== activeFragmentId) &&
    !loadFragmentMutation.isPending &&
    !isLoadingFirstFragment
  ) {
    console.log("[V2ProjectView] Auto-loading active fragment:", activeFragmentId);
    
    loadFragmentMutation.mutate({
      fragmentId: activeFragmentId,
      projectId,
    });
  }
}, [
  isHealthy,
  hasActiveSandbox,
  activeFragmentId,
  loadedFragment?.id,
  projectId,
  loadFragmentMutation.isPending,
  isLoadingFirstFragment,
]);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compilation passes: `pnpm build`
- [ ] No linting errors: `pnpm lint`
- [ ] No React Query warnings about stale queries

#### Manual Verification:
- [ ] File loading works correctly when sandbox becomes healthy
- [ ] Auto-loading fragments works without redundant calls
- [ ] Code view shows files properly in both fragment and all-files modes

---

## Testing Strategy

### Unit Tests:
- Test component renders correctly with different hook state combinations
- Test that manual recovery triggers are removed
- Test UI state computation with various hook states

### Integration Tests:
- Test full sandbox recovery flow end-to-end
- Test fragment loading and switching
- Test project switching behavior

### Manual Testing Steps:
1. Open project and verify sandbox loads without redundant API calls
2. Switch between projects and verify clean state reset
3. Let sandbox expire and verify automatic recovery works
4. Test fragment loading and code view functionality
5. Test window focus/blur behavior (should rely on hook only)
6. Check browser dev tools for reduced re-render count

## Performance Considerations

### Expected Improvements:
- **Reduced re-renders**: Eliminating callback dependency cascades
- **Fewer API calls**: Removing redundant health checks and recovery triggers  
- **Better UX**: Trusting hook's intelligent recovery timing instead of racing it
- **Simplified debugging**: Cleaner component logic with single source of truth

### Memory Impact:
- Reduced useEffect cleanup functions
- Fewer state variables and refs
- Simpler dependency arrays

## Migration Notes

This is a pure refactoring with no external API changes:
- Component props interface remains unchanged
- tRPC procedures unchanged
- Hook interface and behavior unchanged
- Only internal component logic simplified

The refactoring eliminates race conditions between component logic and hook logic by establishing the hook as the single source of truth for sandbox state management.

## References

- Current implementation: `src/modules/projects/ui/view/v2-project-view.tsx`
- Hook implementation: `src/hooks/useSandboxHealthV2.ts`
- Related procedures: `src/modules/projects/server/procedures.ts`
- Fragment management: `src/modules/projects/ui/components/V2FragmentsList.tsx`