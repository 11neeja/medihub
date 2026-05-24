'use client';

import { createContext, useContext, ReactNode } from 'react';
import { createNoteAPI } from '@/lib/api';

interface NoteBlock {
  type: 'heading' | 'text' | 'bullet' | 'checklist' | 'divider';
  text: string;
  checked?: boolean;
}

interface AddNoteParams {
  subject: string;
  title: string;
  content?: string;
  blocks?: NoteBlock[];
  tags?: string[];
}

interface AppContextType {
  addNote: (note: AddNoteParams) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const addNote = async (note: AddNoteParams) => {
    try {
      const blocks = note.blocks && note.blocks.length > 0
        ? note.blocks
        : [{ type: 'text' as const, text: note.content || '' }];

      await createNoteAPI({
        title: note.title,
        subject: note.subject,
        blocks,
        tags: note.tags || ['AI Assistant'],
      });
    } catch (err) {
      console.error('Failed to save note:', err);
    }
  };

  return (
    <AppContext.Provider value={{ addNote }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
