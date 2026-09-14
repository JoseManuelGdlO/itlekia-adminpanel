import { useEffect, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import { useAuth } from '../context/AuthContext';
import KanbanColumn from '../components/kanban/KanbanColumn';
import TaskFormModal from '../components/kanban/TaskFormModal';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

export default function KanbanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    tasksApi.listTasks().then(setTasks);
    projectsApi.listProjects().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(String(data[0].id));
    });
  }, []);

  useEffect(() => {
    let ignore = false;
    setMembers([]);

    if (!selectedProjectId) {
      return () => {
        ignore = true;
      };
    }

    projectsApi.listMembers(selectedProjectId).then((data) => {
      if (!ignore) setMembers(data);
    });

    return () => {
      ignore = true;
    };
  }, [selectedProjectId]);

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

  const visibleTasks = tasks.filter((t) => String(t.projectId) === String(selectedProjectId));

  function canDragTask(task) {
    return user.role === 'admin' || String(task.assigneeId) === String(user.id);
  }

  return (
    <div className="p-6">
      {projects.length > 0 && (
        <div className="mb-4 flex items-center justify-end gap-2">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-md border border-input bg-card px-2 py-2 text-sm"
          >
            {projects.map((project) => (
              <option key={project.id} value={String(project.id)}>
                {project.name}
              </option>
            ))}
          </select>
          {selectedProjectId && (
            <TaskFormModal projectId={selectedProjectId} users={members} onCreated={handleTaskCreated} />
          )}
        </div>
      )}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          {STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              tasks={visibleTasks.filter((t) => t.status === status)}
              canDragTask={canDragTask}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
