import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageSkeleton from './PageSkeleton';

export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();

  if (loading) return <PageSkeleton fill />;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
