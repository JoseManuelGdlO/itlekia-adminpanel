import { useNavigate, useParams } from 'react-router-dom';
import TaskDetailView from '../components/tasks/TaskDetailView';

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  return <TaskDetailView taskId={id} onDeleted={() => navigate('/kanban')} />;
}
