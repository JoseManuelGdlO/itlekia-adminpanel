import { useEffect, useState } from 'react';
import { DndContext } from '@dnd-kit/core';
import * as tasksApi from '../api/tasks';
import KanbanColumn from '../components/kanban/KanbanColumn';

const STATUSES = ['todo', 'in_progress', 'review', 'done'];

export default function KanbanPage() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    tasksApi.listTasks().then(setTasks);
  }, []);

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

  return (
    <div className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Kanban</h1>
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
