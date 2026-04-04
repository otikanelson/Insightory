import { useAuth } from '../context/AuthContext';

export type FeaturePermission = 
  | 'viewInventory'
  | 'addProducts'
  | 'editProducts'
  | 'deleteProducts'
  | 'processSales'
  | 'scanBarcodes'
  | 'viewAnalytics'
  | 'exportData'
  | 'manageCategories';

interface FeatureAccessResult {
  isAllowed: boolean;
  reason?: string;
  isViewOnly: boolean;
  isStaffWithoutPermission: boolean;
}

export const useFeatureAccess = (requiredPermission?: FeaturePermission): FeatureAccessResult => {
  const { user, role } = useAuth();

  // Check if admin is in view-only mode
  if (user?.isViewOnly) {
    return {
      isAllowed: false,
      reason: 'View-Only Mode: You cannot perform actions while viewing a staff account',
      isViewOnly: true,
      isStaffWithoutPermission: false,
    };
  }

  // Admin has full access
  if (role === 'admin') {
    return {
      isAllowed: true,
      isViewOnly: false,
      isStaffWithoutPermission: false,
    };
  }

  // If no specific permission required, allow
  if (!requiredPermission) {
    return {
      isAllowed: true,
      isViewOnly: false,
      isStaffWithoutPermission: false,
    };
  }

  // Check staff permissions
  const hasPermission = user?.permissions?.[requiredPermission] ?? false;

  if (!hasPermission) {
    return {
      isAllowed: false,
      reason: `Permission Denied: You don't have permission to ${getPermissionLabel(requiredPermission)}`,
      isViewOnly: false,
      isStaffWithoutPermission: true,
    };
  }

  return {
    isAllowed: true,
    isViewOnly: false,
    isStaffWithoutPermission: false,
  };
};

const getPermissionLabel = (permission: FeaturePermission): string => {
  const labels: Record<FeaturePermission, string> = {
    viewInventory: 'view inventory',
    addProducts: 'add products',
    editProducts: 'edit products',
    deleteProducts: 'delete products',
    processSales: 'process sales',
    scanBarcodes: 'scan barcodes',
    viewAnalytics: 'view analytics',
    exportData: 'export data',
    manageCategories: 'manage categories',
  };
  return labels[permission];
};
