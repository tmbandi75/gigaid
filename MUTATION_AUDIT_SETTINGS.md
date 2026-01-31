# Settings Components Mutation Audit Report

**Date:** January 31, 2026  
**Scope:** Settings component files (AutomationSettings, SubscriptionSettings, AddServiceDialog, BioEditor, EmailSignatureSettings, StripeConnectSettings)

---

## Executive Summary

**Total Mutations Audited:** 10  
**Status OK:** 7 ✅  
**Status NEEDS FIX:** 3 ⚠️  

**Critical Issues Found:** 2 mutations missing cache invalidation patterns

---

## Component 1: AutomationSettings.tsx

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/AutomationSettings.tsx |
| **Mutation** | saveMutation |
| **API** | PUT /api/automation-settings |
| **Has Invalidation** | YES ✅ |
| **Has Local State Update** | NO (via useEffect from useQuery) |
| **Has Refetch** | YES (via invalidateQueries) |
| **Status** | ✅ OK |
| **Implementation** | `queryClient.invalidateQueries({ queryKey: ["/api/automation-settings"] })` |
| **Fix Needed** | None |

**Analysis:** Properly invalidates the automation settings cache after successful mutation. Local state is synced from the useQuery hook, so no additional state update is needed.

---

## Component 2: SubscriptionSettings.tsx

### Mutation 2a: cancelMutation

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/SubscriptionSettings.tsx |
| **Mutation** | cancelMutation |
| **API** | POST /api/subscription/cancel |
| **Has Invalidation** | YES ✅ |
| **Has Local State Update** | NO |
| **Has Refetch** | YES (via invalidateQueries) |
| **Status** | ✅ OK |
| **Implementation** | `queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] })` |
| **Fix Needed** | None |

---

### Mutation 2b: reactivateMutation

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/SubscriptionSettings.tsx |
| **Mutation** | reactivateMutation |
| **API** | POST /api/subscription/reactivate |
| **Has Invalidation** | YES ✅ |
| **Has Local State Update** | NO |
| **Has Refetch** | YES (via invalidateQueries) |
| **Status** | ✅ OK |
| **Implementation** | `queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] })` |
| **Fix Needed** | None |

---

### Mutation 2c: portalMutation

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/SubscriptionSettings.tsx |
| **Mutation** | portalMutation |
| **API** | POST /api/subscription/portal |
| **Has Invalidation** | NO ❌ |
| **Has Local State Update** | NO |
| **Has Refetch** | NO |
| **Status** | ⚠️ NEEDS FIX |
| **Current Behavior** | Opens Stripe billing portal in new window |
| **Issue** | No cache invalidation - subscription state may have changed in the portal |

**Fix Needed:**
```typescript
const portalMutation = useMutation({
  mutationFn: async () => {
    return apiRequest("POST", "/api/subscription/portal", { returnUrl: "/settings" });
  },
  onSuccess: (data: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] }); // ADD THIS
    if (data.url) {
      window.location.href = data.url;
    }
  },
  onError: () => {
    toast({
      title: "Error",
      description: "Failed to open billing portal. Please try again.",
      variant: "destructive",
    });
  },
});
```

---

## Component 3: AddServiceDialog.tsx

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/AddServiceDialog.tsx |
| **Mutation** | saveMutation |
| **API** | PATCH /api/profile |
| **Has Invalidation** | YES ✅ (Multiple) |
| **Has Local State Update** | NO |
| **Has Refetch** | YES (via invalidateQueries) |
| **Status** | ✅ OK |
| **Implementation** | Multiple invalidations: `/api/profile`, `/api/dashboard/game-plan`, `/api/onboarding` |
| **Fix Needed** | None |

**Analysis:** Excellent pattern - invalidates all related queries that depend on the updated profile data. Prevents stale data across the application.

---

## Component 4: BioEditor.tsx

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/BioEditor.tsx |
| **Mutation** | rewriteMutation |
| **API** | POST /api/ai/rewrite-bio |
| **Has Invalidation** | NO |
| **Has Local State Update** | YES ✅ |
| **Has Refetch** | NO |
| **Status** | ✅ OK |
| **Implementation** | `onChange(data.rewrittenBio)` - updates parent component state |
| **Fix Needed** | None |

**Analysis:** This is a form component that updates local state through the parent's onChange callback. The rewritten bio is displayed immediately in the form. No cache invalidation needed since this is just preview functionality - the bio is only saved when the parent form is submitted.

---

## Component 5: EmailSignatureSettings.tsx

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/EmailSignatureSettings.tsx |
| **Mutation** | updateMutation |
| **API** | PUT /api/user/email-signature |
| **Has Invalidation** | YES ✅ |
| **Has Local State Update** | NO (via useEffect from useQuery) |
| **Has Refetch** | YES (via invalidateQueries) |
| **Status** | ✅ OK |
| **Implementation** | `queryClient.invalidateQueries({ queryKey: ["/api/user/email-signature"] })` |
| **Fix Needed** | None |

**Analysis:** Properly invalidates cache. Local state is synced from useQuery hook on mount and when signature data changes.

---

## Component 6: StripeConnectSettings.tsx

### Mutation 6a: onboardMutation

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/StripeConnectSettings.tsx |
| **Mutation** | onboardMutation |
| **API** | POST /api/stripe/connect/onboard |
| **Has Invalidation** | NO ❌ |
| **Has Local State Update** | NO |
| **Has Refetch** | NO |
| **Status** | ⚠️ NEEDS FIX |
| **Current Behavior** | Opens Stripe onboarding flow in new window |
| **Issue** | No cache invalidation - user completes onboarding in new tab but status not reflected |

**Fix Needed:**
```typescript
const onboardMutation = useMutation({
  mutationFn: () => apiRequest("POST", "/api/stripe/connect/onboard"),
  onSuccess: (data: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/stripe/connect/status"] }); // ADD THIS
    if (data.url) {
      window.open(data.url, "_blank");
      toast({ 
        title: "Stripe Setup", 
        description: "Complete your Stripe setup in the new tab. Return here when finished." 
      });
    } else {
      toast({ title: "Failed to get onboarding URL", variant: "destructive" });
    }
  },
  onError: (error: any) => {
    console.error("Onboarding error:", error);
    toast({ title: "Failed to start onboarding", variant: "destructive" });
  },
});
```

**Note:** While the component has `refetchInterval: 30000` on the status query, immediate invalidation will provide better UX when the user returns to the page.

---

### Mutation 6b: dashboardMutation

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/StripeConnectSettings.tsx |
| **Mutation** | dashboardMutation |
| **API** | POST /api/stripe/connect/dashboard |
| **Has Invalidation** | NO ❌ |
| **Has Local State Update** | NO |
| **Has Refetch** | NO |
| **Status** | ⚠️ NEEDS FIX (Minor - Documentation) |
| **Current Behavior** | Opens Stripe dashboard in new window |
| **Issue** | No cache invalidation pattern (though user may modify data in dashboard) |

**Fix Suggested (Optional):**
```typescript
const dashboardMutation = useMutation({
  mutationFn: () => apiRequest("POST", "/api/stripe/connect/dashboard"),
  onSuccess: (data: any) => {
    queryClient.invalidateQueries({ queryKey: ["/api/stripe/connect/status"] }); // OPTIONAL
    if (data.url) {
      window.open(data.url, "_blank");
    } else {
      toast({ title: "Failed to get dashboard URL", variant: "destructive" });
    }
  },
  onError: (error: any) => {
    console.error("Dashboard error:", error);
    toast({ 
      title: "Cannot open dashboard", 
      description: "Please complete your Stripe setup first.",
      variant: "destructive" 
    });
  },
});
```

**Rationale:** User may make changes in the Stripe dashboard that affect the connection status or settings. Invalidating the status query ensures the UI reflects any changes.

---

### Mutation 6c: saveDepositMutation

| Field | Value |
|-------|-------|
| **File** | client/src/components/settings/StripeConnectSettings.tsx |
| **Mutation** | saveDepositMutation |
| **API** | PATCH /api/stripe/connect/deposit-settings |
| **Has Invalidation** | YES ✅ |
| **Has Local State Update** | NO (via useEffect from useQuery) |
| **Has Refetch** | YES (via invalidateQueries) |
| **Status** | ✅ OK |
| **Implementation** | `queryClient.invalidateQueries({ queryKey: ["/api/profile"] })` |
| **Fix Needed** | None |

**Analysis:** Properly invalidates the profile query, which contains deposit settings. Local state is synced from the profile query via useEffect.

---

## Summary Table

| Component | Mutation | Endpoint | Invalidation | Status |
|-----------|----------|----------|--------------|--------|
| AutomationSettings | saveMutation | PUT /api/automation-settings | YES | ✅ OK |
| SubscriptionSettings | cancelMutation | POST /api/subscription/cancel | YES | ✅ OK |
| SubscriptionSettings | reactivateMutation | POST /api/subscription/reactivate | YES | ✅ OK |
| SubscriptionSettings | portalMutation | POST /api/subscription/portal | NO | ⚠️ FIX |
| AddServiceDialog | saveMutation | PATCH /api/profile | YES | ✅ OK |
| BioEditor | rewriteMutation | POST /api/ai/rewrite-bio | N/A (Local) | ✅ OK |
| EmailSignatureSettings | updateMutation | PUT /api/user/email-signature | YES | ✅ OK |
| StripeConnectSettings | onboardMutation | POST /api/stripe/connect/onboard | NO | ⚠️ FIX |
| StripeConnectSettings | dashboardMutation | POST /api/stripe/connect/dashboard | NO | ⚠️ FIX |
| StripeConnectSettings | saveDepositMutation | PATCH /api/stripe/connect/deposit-settings | YES | ✅ OK |

---

## Detailed Findings

### Critical Issues

**1. portalMutation (SubscriptionSettings.tsx)**
- **Risk:** User opens billing portal, makes subscription changes, returns to settings page with stale data
- **Impact:** HIGH - Could show incorrect plan/billing info
- **Fix Complexity:** LOW - One-line addition of invalidateQueries

**2. onboardMutation (StripeConnectSettings.tsx)**
- **Risk:** User completes Stripe onboarding in new tab, returns to settings with stale connection status
- **Impact:** HIGH - UI won't show "Connected" status until auto-refresh (30s delay)
- **Fix Complexity:** LOW - One-line addition of invalidateQueries

### Minor Issues

**3. dashboardMutation (StripeConnectSettings.tsx)**
- **Risk:** LOW - User opens dashboard, makes changes, returns with stale data
- **Impact:** MEDIUM - User may modify settings that affect the connection status
- **Fix Complexity:** LOW - One-line addition of invalidateQueries

---

## Best Practices Observed

✅ **Correct:** Using `useMutation` with React Query  
✅ **Correct:** Calling `apiRequest` for all API operations  
✅ **Correct:** Implementing error handlers with user feedback (toast)  
✅ **Correct:** Loading states via `isPending` / `isLoading`  
✅ **Correct:** Using array-based query keys for proper invalidation  
✅ **Correct:** Most mutations invalidate dependent queries  

---

## Recommendations

### Priority 1: High (Do First)
1. **Fix portalMutation** - Add cache invalidation to ensure subscription status is current after user returns from Stripe portal
2. **Fix onboardMutation** - Add cache invalidation to immediately reflect completed onboarding status

### Priority 2: Medium (Nice to Have)
3. **Fix dashboardMutation** - Add cache invalidation for consistency, though user is less likely to modify data in dashboard

### Priority 3: Documentation
4. Add comments explaining why certain mutations (like dashboardMutation) don't strictly require invalidation

---

## Conclusion

**Overall Status:** ⚠️ NEEDS ATTENTION

Two critical mutations (portalMutation, onboardMutation) are missing cache invalidation patterns. These should be fixed to ensure proper UI rehydration and prevent users from seeing stale data when returning from external Stripe flows.

All other mutations properly handle UI rehydration through either cache invalidation or local state updates.

**Estimated Fix Time:** 5 minutes (3 one-line fixes)
