'use client';

import React from 'react';
import KanbanBoard from './KanbanBoard';

export default function DashboardPage() {
 return (
    <div className="flex flex-col h-full bg-muted p-6">
      <KanbanBoard />
    </div>
  );
}