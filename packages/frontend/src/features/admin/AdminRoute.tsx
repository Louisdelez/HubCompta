// ============================================================================
// ADMIN ROUTE GUARD - Finance Hub
// Protects admin routes from non-admin users
// ============================================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { Loader2 } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!user?.isInstanceAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default AdminRoute;
