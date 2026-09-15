import { useEffect, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import * as tasksApi from '../api/tasks';
import * as projectsApi from '../api/projects';
import * as columnsApi from '../api/columns';
import { useAuth } from '../context/AuthContext';
import KanbanColumn from '../components/kanban/KanbanColumn';
import TaskFormModal from '../components/kanban/TaskFormModal';

export default function KanbanPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [columns, setColumns] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  useEffect(() => {
    projectsApi.listProjects().then((data) => {
      setProjects(data);
      if (data.length > 0) setSelectedProjectId(String(data[0].id));
    });
  }, []);

  useEffect(() => {
    let ignore = false;
    setTasks([]);
    setMembers([]);
    setColumns([]);

    if (!selectedProjectId) {
      return () => {
        ignore = true;
      };
    }

    tasksApi.listTasks({ projectId: selectedProjectId }).then((data) => {
      if (!ignore) setTasks(data);
    });
    projectsApi.listMembers(selectedProjectId).then((data) => {
      if (!ignore) setMembers(data);
    });
    columnsApi.listColumns(selectedProjectId).then((data) => {
      if (!ignore) setColumns(data);
    });

    return () => {
      ignore = true;
    };
  }, [selectedProjectId]);

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over) return;

    const taskId = Number(active.id);
    const newColumnId = Number(over.id);

    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, columnId: newColumnId } : t)));

    try {
      await tasksApi.updateTaskColumn(taskId, newColumnId);
    } catch {
      tasksApi.listTasks({ projectId: selectedProjectId }).then(setTasks);
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
        <div className="mb-4 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto" role="tablist">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                role="tab"
                aria-selected={String(selectedProjectId) === String(project.id)}
                onClick={() => setSelectedProjectId(String(project.id))}
                className={`shrink-0 rounded-md px-3 py-2 text-sm ${
                  String(selectedProjectId) === String(project.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
          {selectedProjectId && (
            <TaskFormModal projectId={selectedProjectId} users={members} onCreated={handleTaskCreated} />
          )}
        </div>
      )}
      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              tasks={visibleTasks.filter((t) => String(t.columnId) === String(column.id))}
              canDragTask={canDragTask}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
