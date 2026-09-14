import { useEffect, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import * as usersApi from '../api/users';
import { useAuth } from '../context/AuthContext';
import KanbanColumn from '../components/kanban/KanbanColumn';
import TaskFormModal from '../components/kanban/TaskFormModal';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

export default function KanbanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    tasksApi.listTasks().then(setTasks);
    projectsApi.listProjects().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(data[0].id);
    });
    if (user.role === 'admin') {
      usersApi.listUsers().then(setUsers);
    }
  }, [user.role]);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const taskId = Number(active.id);
    const newStatus = over.id;

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    try {
      await tasksApi.updateTaskStatus(taskId, newStatus);
    } catch {
      tasksApi.listTasks().then(setTasks);
    }
  }

  function handleTaskCreated(task) {
    setTasks((prev) => [...prev, task]);
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Kanban</h1>
        {user.role === 'admin' && selectedProjectId && (
          <div className="flex items-center gap-2">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded border px-2 py-2 text-sm"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <TaskFormModal projectId={selectedProjectId} users={users} onCreated={handleTaskCreated} />
          </div>
        )}
      </div>
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={tasks.filter((t) => t.status === status)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
