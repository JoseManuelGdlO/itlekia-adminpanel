import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import TeamPage from './pages/TeamPage';
import UsersPage from './pages/UsersPage';
import KanbanPage from './pages/KanbanPage';
import NotesPage from './pages/NotesPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import TaskDetailPage from './pages/TaskDetailPage';

function AuthenticatedLayout({ children, role }) {
  return (
    <ProtectedRoute role={role}>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<AuthenticatedLayout><DashboardPage /></AuthenticatedLayout>} />
          <Route path="/kanban" element={<AuthenticatedLayout><KanbanPage /></AuthenticatedLayout>} />
          <Route path="/projects" element={<AuthenticatedLayout><ProjectsPage /></AuthenticatedLayout>} />
          <Route path="/projects/:id" element={<AuthenticatedLayout><ProjectDetailPage /></AuthenticatedLayout>} />
          <Route path="/tasks/:id" element={<AuthenticatedLayout><TaskDetailPage /></AuthenticatedLayout>} />
          <Route path="/team" element={<AuthenticatedLayout role="admin"><TeamPage /></AuthenticatedLayout>} />
          <Route path="/users" element={<AuthenticatedLayout role="admin"><UsersPage /></AuthenticatedLayout>} />
          <Route path="/notes" element={<AuthenticatedLayout><NotesPage /></AuthenticatedLayout>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
