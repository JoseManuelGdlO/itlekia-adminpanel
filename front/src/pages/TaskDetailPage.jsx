import { useParams } from 'react-router-dom';
import TaskDetailView from '../components/tasks/TaskDetailView';

export default function TaskDetailPage() {
  const { id } = useParams();
  return <TaskDetailView taskId={id} />;
}
