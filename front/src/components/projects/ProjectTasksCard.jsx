import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as tasksApi from '../../api/tasks';
import * as columnsApi from '../../api/columns';
import * as projectsApi from '../../api/projects';
import TaskFormModal from '../kanban/TaskFormModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProjectTasksCard({ projectId }) {
  const [tasks, setTasks] = useState([]);
  const [columns, setColumns] = useState([]);
  const [members, setMembers] = useState([]);

  useEffect(() => {
    tasksApi.listTasks({ projectId }).then(setTasks);
    columnsApi.listColumns(projectId).then(setColumns);
    projectsApi.listAssignees(projectId).then(setMembers);
  }, [projectId]);

  function handleCreated(task) {
    setTasks((prev) => [...prev, task]);
  }

  const columnName = (columnId) =>
    columns.find((column) => String(column.id) === String(columnId))?.name || '';
  const memberName = (assigneeId) =>
    members.find((member) => String(member.id) === String(assigneeId))?.name || 'Sin asignar';

  return (
    <Card className="shadow-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Tareas</CardTitle>
        <TaskFormModal projectId={projectId} users={members} onCreated={handleCreated} />
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay tareas</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {tasks.map((task) => (
              <li key={task.id} className="flex flex-wrap gap-2">
                <Link to={`/tasks/${task.id}`} className="text-primary hover:underline">
                  {task.title}
                </Link>
                <span className="text-muted-foreground">{memberName(task.assigneeId)}</span>
                <span className="text-muted-foreground">{columnName(task.columnId)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
