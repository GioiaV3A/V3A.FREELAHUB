export type PermissionKey =
  | 'users.view' | 'users.create' | 'users.update' | 'users.deactivate'
  | 'nuclei.view' | 'nuclei.create' | 'nuclei.updateStructuralData' | 'nuclei.delete'
  | 'freelancers.view' | 'freelancers.createManual' | 'freelancers.updateCanonical' | 'freelancers.delete' | 'freelancers.generatePublicLink'
  | 'preRegistrations.view' | 'preRegistrations.approve' | 'preRegistrations.reject' | 'preRegistrations.merge'
  | 'opportunities.view' | 'opportunities.create' | 'opportunities.update' | 'opportunities.allNuclei'
  | 'negotiations.view' | 'negotiations.manage' | 'negotiations.requestApproval' | 'negotiations.approveException'
  | 'policies.view' | 'policies.create' | 'policies.update' | 'policies.delete'
  | 'allocations.view' | 'allocations.allNuclei'
  | 'paymentRequests.view' | 'paymentRequests.create' | 'paymentRequests.export'
  | 'reports.viewOperational' | 'reports.exportOperational';

export type UserRole = 'master' | 'rh' | 'c_level' | 'nucleo' | 'operations' | 'operacao';

export const ROLE_PERMISSIONS: Record<UserRole, { scope: 'all_nuclei' | 'single_nucleus'; permissions: Record<PermissionKey, boolean> }> = {
  master: {
    scope: 'all_nuclei',
    permissions: {
      'users.view': true, 'users.create': true, 'users.update': true, 'users.deactivate': true,
      'nuclei.view': true, 'nuclei.create': true, 'nuclei.updateStructuralData': true, 'nuclei.delete': true,
      'freelancers.view': true, 'freelancers.createManual': true, 'freelancers.updateCanonical': true, 'freelancers.delete': true, 'freelancers.generatePublicLink': true,
      'preRegistrations.view': true, 'preRegistrations.approve': true, 'preRegistrations.reject': true, 'preRegistrations.merge': true,
      'opportunities.view': true, 'opportunities.create': true, 'opportunities.update': true, 'opportunities.allNuclei': true,
      'negotiations.view': true, 'negotiations.manage': true, 'negotiations.requestApproval': true, 'negotiations.approveException': true,
      'policies.view': true, 'policies.create': true, 'policies.update': true, 'policies.delete': true,
      'allocations.view': true, 'allocations.allNuclei': true,
      'paymentRequests.view': true, 'paymentRequests.create': true, 'paymentRequests.export': true,
      'reports.viewOperational': true, 'reports.exportOperational': true
    }
  },
  rh: {
    scope: 'all_nuclei',
    permissions: {
      'users.view': true, 'users.create': true, 'users.update': true, 'users.deactivate': true,
      'nuclei.view': true, 'nuclei.create': true, 'nuclei.updateStructuralData': true, 'nuclei.delete': false,
      'freelancers.view': true, 'freelancers.createManual': true, 'freelancers.updateCanonical': true, 'freelancers.delete': false, 'freelancers.generatePublicLink': true,
      'preRegistrations.view': true, 'preRegistrations.approve': true, 'preRegistrations.reject': true, 'preRegistrations.merge': true,
      'opportunities.view': true, 'opportunities.create': true, 'opportunities.update': true, 'opportunities.allNuclei': true,
      'negotiations.view': true, 'negotiations.manage': true, 'negotiations.requestApproval': true, 'negotiations.approveException': true,
      'policies.view': true, 'policies.create': false, 'policies.update': false, 'policies.delete': false,
      'allocations.view': true, 'allocations.allNuclei': true,
      'paymentRequests.view': true, 'paymentRequests.create': true, 'paymentRequests.export': true,
      'reports.viewOperational': true, 'reports.exportOperational': true
    }
  },
  c_level: {
    scope: 'all_nuclei',
    permissions: {
      'users.view': true, 'users.create': false, 'users.update': false, 'users.deactivate': false,
      'nuclei.view': true, 'nuclei.create': false, 'nuclei.updateStructuralData': false, 'nuclei.delete': false,
      'freelancers.view': true, 'freelancers.createManual': false, 'freelancers.updateCanonical': false, 'freelancers.delete': false, 'freelancers.generatePublicLink': true,
      'preRegistrations.view': false, 'preRegistrations.approve': false, 'preRegistrations.reject': false, 'preRegistrations.merge': false,
      'opportunities.view': true, 'opportunities.create': true, 'opportunities.update': true, 'opportunities.allNuclei': true,
      'negotiations.view': true, 'negotiations.manage': true, 'negotiations.requestApproval': true, 'negotiations.approveException': true,
      'policies.view': true, 'policies.create': false, 'policies.update': false, 'policies.delete': false,
      'allocations.view': true, 'allocations.allNuclei': true,
      'paymentRequests.view': true, 'paymentRequests.create': true, 'paymentRequests.export': true,
      'reports.viewOperational': true, 'reports.exportOperational': true
    }
  },
  operations: {
    scope: 'all_nuclei',
    permissions: {
      'users.view': false, 'users.create': false, 'users.update': false, 'users.deactivate': false,
      'nuclei.view': true, 'nuclei.create': false, 'nuclei.updateStructuralData': false, 'nuclei.delete': false,
      'freelancers.view': true, 'freelancers.createManual': false, 'freelancers.updateCanonical': false, 'freelancers.delete': false, 'freelancers.generatePublicLink': true,
      'preRegistrations.view': false, 'preRegistrations.approve': false, 'preRegistrations.reject': false, 'preRegistrations.merge': false,
      'opportunities.view': true, 'opportunities.create': true, 'opportunities.update': true, 'opportunities.allNuclei': true,
      'negotiations.view': true, 'negotiations.manage': true, 'negotiations.requestApproval': true, 'negotiations.approveException': false,
      'policies.view': true, 'policies.create': false, 'policies.update': false, 'policies.delete': false,
      'allocations.view': true, 'allocations.allNuclei': true,
      'paymentRequests.view': true, 'paymentRequests.create': true, 'paymentRequests.export': true,
      'reports.viewOperational': true, 'reports.exportOperational': true
    }
  },
  operacao: {
    scope: 'all_nuclei',
    permissions: {
      'users.view': false, 'users.create': false, 'users.update': false, 'users.deactivate': false,
      'nuclei.view': true, 'nuclei.create': false, 'nuclei.updateStructuralData': false, 'nuclei.delete': false,
      'freelancers.view': true, 'freelancers.createManual': false, 'freelancers.updateCanonical': false, 'freelancers.delete': false, 'freelancers.generatePublicLink': true,
      'preRegistrations.view': false, 'preRegistrations.approve': false, 'preRegistrations.reject': false, 'preRegistrations.merge': false,
      'opportunities.view': true, 'opportunities.create': true, 'opportunities.update': true, 'opportunities.allNuclei': true,
      'negotiations.view': true, 'negotiations.manage': true, 'negotiations.requestApproval': true, 'negotiations.approveException': false,
      'policies.view': true, 'policies.create': false, 'policies.update': false, 'policies.delete': false,
      'allocations.view': true, 'allocations.allNuclei': true,
      'paymentRequests.view': true, 'paymentRequests.create': true, 'paymentRequests.export': true,
      'reports.viewOperational': true, 'reports.exportOperational': true
    }
  },
  nucleo: {
    scope: 'single_nucleus',
    permissions: {
      'users.view': false, 'users.create': false, 'users.update': false, 'users.deactivate': false,
      'nuclei.view': true, 'nuclei.create': false, 'nuclei.updateStructuralData': false, 'nuclei.delete': false,
      'freelancers.view': true, 'freelancers.createManual': false, 'freelancers.updateCanonical': false, 'freelancers.delete': false, 'freelancers.generatePublicLink': true,
      'preRegistrations.view': false, 'preRegistrations.approve': false, 'preRegistrations.reject': false, 'preRegistrations.merge': false,
      'opportunities.view': true, 'opportunities.create': true, 'opportunities.update': true, 'opportunities.allNuclei': false,
      'negotiations.view': true, 'negotiations.manage': true, 'negotiations.requestApproval': true, 'negotiations.approveException': false,
      'policies.view': true, 'policies.create': false, 'policies.update': false, 'policies.delete': false,
      'allocations.view': true, 'allocations.allNuclei': false,
      'paymentRequests.view': true, 'paymentRequests.create': false, 'paymentRequests.export': false,
      'reports.viewOperational': false, 'reports.exportOperational': false
    }
  }
};

export function can(user: { role: string | null | undefined } | null | undefined, permission: PermissionKey): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toLowerCase() as UserRole;
  const roleConfig = ROLE_PERMISSIONS[role];
  if (!roleConfig) return false;
  return !!roleConfig.permissions[permission];
}

export function hasDataScope(user: { role: string | null | undefined } | null | undefined, scope: 'all_nuclei' | 'single_nucleus'): boolean {
  if (!user || !user.role) return false;
  const role = user.role.toLowerCase() as UserRole;
  const roleConfig = ROLE_PERMISSIONS[role];
  if (!roleConfig) return false;
  return roleConfig.scope === scope;
}
