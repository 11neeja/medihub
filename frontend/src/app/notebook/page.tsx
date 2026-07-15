'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen, Folder, FileText, Search, Trash2, CheckSquare, BookOpen,
  Upload, Eye, X, Inbox, PenLine, Bot, Tag, Heading, Type, List, Minus,
  Paperclip, Presentation, FileEdit, Calendar, Loader2, Plus, FolderPlus,
  Image, Table, File, Pencil, ChevronUp, ChevronDown, Download,
  ArrowLeft, Wrench
} from 'lucide-react';
import { getNotesAPI, createNoteAPI, updateNoteAPI, deleteNoteAPI, getTasksAPI, createTaskAPI, toggleTaskAPI, deleteTaskAPI, getSubjectsAPI, createSubjectAPI, renameSubjectAPI, deleteSubjectAPI, getDocumentsAPI, uploadDocumentAPI, downloadDocumentAPI, deleteDocumentAPI, getAiMessagesAPI, reorderNotesAPI } from '@/lib/api';
import ResizableSidebar from '@/components/ResizableSidebar';
import ConfirmModal from '@/components/ConfirmModal';
import { markdownToBlocks } from '@/lib/markdownToBlocks';

// Type definitions
type BlockType = 'heading' | 'text' | 'checklist' | 'bullet' | 'divider';

interface Block {
  id: string;
  type: BlockType;
  text: string;
  checked?: boolean;
}

interface NotePage {
  id: string;
  title: string;
  subject: string;
  blocks: Block[];
  position: number;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

interface Task {
  id: string;
  title: string;
  completed: boolean;
}

interface UploadedFile {
  id: string;
  name: string;
  type: 'pdf' | 'ppt' | 'doc' | 'image' | 'csv' | 'excel' | 'other';
  uploadedAt: string;
  url?: string;
  mimeType?: string;
}

// Mock data - Initial pages organized by subject
const initialPages: NotePage[] = [];

// Muted, on-brand accent colors assigned deterministically per subject name.
const SUBJECT_ACCENTS = [
  { dot: '#0B3B91', soft: '#E6F0FF' }, // blue
  { dot: '#047857', soft: '#E7F6F0' }, // emerald
  { dot: '#B45309', soft: '#FBF0DD' }, // amber
  { dot: '#6D28D9', soft: '#F1E9FB' }, // violet
  { dot: '#BE123C', soft: '#FBE6EA' }, // rose
  { dot: '#0F766E', soft: '#E2F4F2' }, // teal
];

const accentForSubject = (subject: string) => {
  let hash = 0;
  for (let i = 0; i < subject.length; i++) {
    hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  }
  return SUBJECT_ACCENTS[hash % SUBJECT_ACCENTS.length];
};

// CSV Preview component
function CsvPreview({ url }: { url: string }) {
  const [rows, setRows] = useState<string[][]>([]);

  useEffect(() => {
    fetch(url)
      .then(res => res.text())
      .then(text => {
        const parsed = text.split('\n').map(line =>
          line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
        );
        setRows(parsed.filter(r => r.some(c => c.length > 0)));
      })
      .catch(console.error);
  }, [url]);

  if (rows.length === 0) {
    return (
      <div className="h-full p-6 space-y-3">
        <div className="skeleton h-8 w-full" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton h-6 w-full" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full p-4">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr>
            {rows[0]?.map((cell, i) => (
              <th key={i} className="border border-[var(--color-border-light)] bg-[var(--color-blue-soft)] px-3 py-2 text-left font-semibold text-[var(--color-text-primary)]">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(1).map((row, ri) => (
            <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-[var(--color-border-light)] px-3 py-2 text-[var(--color-text-primary)]">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function NotebookPage() {
  const [pages, setPages] = useState<NotePage[]>([]);
  const [selectedPage, setSelectedPage] = useState<NotePage | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [showNewSubjectInput, setShowNewSubjectInput] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [renamingSubject, setRenamingSubject] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [previewDocument, setPreviewDocument] = useState<UploadedFile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [deleteSubjectTarget, setDeleteSubjectTarget] = useState<string | null>(null);
  const [deletePageTarget, setDeletePageTarget] = useState<NotePage | null>(null);
  const [showAiPicker, setShowAiPicker] = useState(false);
  const [aiMessages, setAiMessages] = useState<{ id: string; sender: string; text: string; createdAt: string; question: string }[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  // Mobile-only view switcher: 'list' = subjects/pages, 'editor' = page editor, 'tools' = tasks/documents.
  // Desktop ignores this (panels render side-by-side via lg: classes).
  const [mobileView, setMobileView] = useState<'list' | 'editor' | 'tools'>('list');

  // Helper to map API note to frontend NotePage shape
  const mapAPINote = (apiNote: any): NotePage => ({
    id: apiNote._id,
    title: apiNote.title,
    subject: apiNote.subject,
    blocks: (apiNote.blocks || []).map((b: any) => ({
      id: b._id || `b${Date.now()}-${Math.random()}`,
      type: b.type,
      text: b.text,
      checked: b.checked,
    })),
    position: apiNote.position ?? 0,
    createdAt: apiNote.createdAt,
    updatedAt: apiNote.updatedAt,
    tags: apiNote.tags,
  });

  // Helper to map API task
  const mapAPITask = (apiTask: any): Task => ({
    id: apiTask._id,
    title: apiTask.title,
    completed: apiTask.completed,
  });

  // Fetch notes, tasks, subjects, and documents from database on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [notesData, tasksData, subjectsData, documentsData] = await Promise.all([
          getNotesAPI(),
          getTasksAPI(),
          getSubjectsAPI(),
          getDocumentsAPI('notebook'),
        ]);
        const mappedNotes = notesData
          .filter((n: any) => n.title !== '__subject_placeholder__')
          .map(mapAPINote);
        setPages(mappedNotes);
        setTasks(tasksData.map(mapAPITask));
        setSubjects(subjectsData || []);
        // Map backend documents to frontend shape
        const mappedDocs: UploadedFile[] = documentsData.map((d: any) => ({
          id: d._id,
          name: d.name,
          type: d.type,
          uploadedAt: new Date(d.createdAt).toISOString().split('T')[0],
        }));
        setUploadedFiles(mappedDocs);
        if (mappedNotes.length > 0) {
          setSelectedPage(mappedNotes[0]);
          setSelectedSubject(mappedNotes[0].subject);
        }
      } catch (err) {
        console.error('Failed to fetch notebook data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Filter pages by search query
  const filteredPages = pages.filter(page =>
    page.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    page.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get pages for selected subject (sorted by position)
  const subjectPages = filteredPages
    .filter(page => page.subject === selectedSubject)
    .sort((a, b) => a.position - b.position);

  // Update page title (auto-saves to database)
  const updatePageTitle = (newTitle: string) => {
    if (!selectedPage) return;

    const updatedPages = pages.map(p =>
      p.id === selectedPage.id
        ? { ...p, title: newTitle, updatedAt: new Date().toISOString() }
        : p
    );

    setPages(updatedPages);
    setSelectedPage({ ...selectedPage, title: newTitle });

    // Save to database (debounced effect would be ideal, but simple save here)
    updateNoteAPI(selectedPage.id, { title: newTitle }).catch(console.error);
  };

  // Update block text (auto-saves to database)
  const updateBlockText = (blockId: string, newText: string) => {
    if (!selectedPage) return;

    const updatedBlocks = selectedPage.blocks.map(b =>
      b.id === blockId ? { ...b, text: newText } : b
    );

    const updatedPage = { ...selectedPage, blocks: updatedBlocks, updatedAt: new Date().toISOString() };

    setPages(pages.map(p => p.id === selectedPage.id ? updatedPage : p));
    setSelectedPage(updatedPage);

    // Save blocks to database
    updateNoteAPI(selectedPage.id, { blocks: updatedBlocks }).catch(console.error);
  };

  // Toggle checklist (auto-saves to database)
  const toggleChecklist = (blockId: string) => {
    if (!selectedPage) return;

    const updatedBlocks = selectedPage.blocks.map(b =>
      b.id === blockId ? { ...b, checked: !b.checked } : b
    );

    const updatedPage = { ...selectedPage, blocks: updatedBlocks, updatedAt: new Date().toISOString() };

    setPages(pages.map(p => p.id === selectedPage.id ? updatedPage : p));
    setSelectedPage(updatedPage);

    updateNoteAPI(selectedPage.id, { blocks: updatedBlocks }).catch(console.error);
  };

  // Add new block (saved to database)
  const addBlock = (type: BlockType) => {
    if (!selectedPage) return;

    const newBlock: Block = {
      id: `b${Date.now()}`,
      type,
      text: type === 'divider' ? '' : `New ${type}...`,
      checked: type === 'checklist' ? false : undefined,
    };

    const updatedBlocks = [...selectedPage.blocks, newBlock];
    const updatedPage = {
      ...selectedPage,
      blocks: updatedBlocks,
      updatedAt: new Date().toISOString(),
    };

    setPages(pages.map(p => p.id === selectedPage.id ? updatedPage : p));
    setSelectedPage(updatedPage);
    setShowBlockMenu(false);

    updateNoteAPI(selectedPage.id, { blocks: updatedBlocks }).catch(console.error);
  };

  // Delete block (saved to database)
  const deleteBlock = (blockId: string) => {
    if (!selectedPage) return;

    const updatedBlocks = selectedPage.blocks.filter(b => b.id !== blockId);
    const updatedPage = { ...selectedPage, blocks: updatedBlocks, updatedAt: new Date().toISOString() };

    setPages(pages.map(p => p.id === selectedPage.id ? updatedPage : p));
    setSelectedPage(updatedPage);

    updateNoteAPI(selectedPage.id, { blocks: updatedBlocks }).catch(console.error);
  };

  // Create new page (saved to database)
  const createNewPage = async () => {
    // No folder yet — send the user to folder creation first
    if (!selectedSubject) {
      setMobileView('list');
      setShowNewSubjectInput(true);
      return;
    }
    try {
      const apiNote = await createNoteAPI({
        title: 'Untitled Page',
        subject: selectedSubject,
        blocks: [
          { type: 'heading', text: 'New Page' },
          { type: 'text', text: 'Start writing...' },
        ],
        tags: [],
      });
      const newPage = mapAPINote(apiNote);
      setPages([...pages, newPage]);
      setSelectedPage(newPage);
      setMobileView('editor');
    } catch (err) {
      console.error('Failed to create note:', err);
    }
  };

  // Add task (saved to database)
  const addTask = async () => {
    if (!newTaskTitle.trim()) return;
    try {
      const apiTask = await createTaskAPI(newTaskTitle);
      setTasks([...tasks, mapAPITask(apiTask)]);
      setNewTaskTitle('');
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  // Toggle task (saved to database)
  const toggleTask = async (taskId: string) => {
    try {
      const updated = await toggleTaskAPI(taskId);
      setTasks(tasks.map(t => t.id === taskId ? mapAPITask(updated) : t));
    } catch (err) {
      console.error('Failed to toggle task:', err);
    }
  };

  // Delete task (from database)
  const deleteTask = async (taskId: string) => {
    try {
      await deleteTaskAPI(taskId);
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  // Handle file upload - stores permanently in database
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    setIsUploading(true);

    const files = Array.from(e.target.files);

    for (const file of files) {
      try {
        const ext = file.name.split('.').pop()?.toLowerCase();
        let type: 'pdf' | 'ppt' | 'doc' | 'image' | 'csv' | 'excel' | 'other' = 'other';
        if (ext === 'pdf') type = 'pdf';
        else if (ext === 'ppt' || ext === 'pptx') type = 'ppt';
        else if (ext === 'doc' || ext === 'docx') type = 'doc';
        else if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext || '')) type = 'image';
        else if (ext === 'csv') type = 'csv';
        else if (['xls', 'xlsx'].includes(ext || '')) type = 'excel';

        const saved = await uploadDocumentAPI({
          name: file.name,
          type,
          file: file,
          source: 'notebook',
        });

        const newFile: UploadedFile = {
          id: saved._id,
          name: saved.name,
          type: saved.type,
          uploadedAt: new Date(saved.createdAt).toISOString().split('T')[0],
        };
        setUploadedFiles(prev => [...prev, newFile]);
      } catch (err) {
        console.error('Failed to upload document:', err);
      }
    }
    setIsUploading(false);
    // Reset the file input
    e.target.value = '';
  };

  // Helper: convert base64 + mimeType to a blob URL
  const base64ToBlobUrl = (base64: string, mimeType: string): string => {
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) {
      byteNumbers[i] = byteChars.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return URL.createObjectURL(blob);
  };

  // Get file icon
  const getFileIcon = (type: string): React.ReactNode => {
    switch (type) {
      case 'pdf': return <FileText className="w-6 h-6 text-red-500" />;
      case 'ppt': return <Presentation className="w-6 h-6 text-orange-500" />;
      case 'doc': return <FileEdit className="w-6 h-6 text-blue-500" />;
      case 'image': return <Image className="w-6 h-6 text-green-500" />;
      case 'csv': return <Table className="w-6 h-6 text-emerald-600" />;
      case 'excel': return <Table className="w-6 h-6 text-green-700" />;
      default: return <File className="w-6 h-6 text-slate-400" />;
    }
  };

  // Open document preview - fetches file data from backend and creates blob URL
  const openDocumentPreview = async (file: UploadedFile) => {
    try {
      const data = await downloadDocumentAPI(file.id);
      const blobUrl = base64ToBlobUrl(data.fileData, data.mimeType);
      setPreviewDocument({ ...file, url: blobUrl, mimeType: data.mimeType });
    } catch (err) {
      console.error('Failed to load document:', err);
    }
  };

  // Close document preview & revoke blob URL
  const closeDocumentPreview = () => {
    if (previewDocument?.url) {
      URL.revokeObjectURL(previewDocument.url);
    }
    setPreviewDocument(null);
  };

  // Move page up within subject
  const movePageUp = async (page: NotePage, index: number) => {
    if (index === 0) return;
    const currentSubjectPages = pages.filter(p => p.subject === page.subject && p.title !== '__subject_placeholder__');
    const sorted = [...currentSubjectPages].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(p => p.id === page.id);
    if (idx <= 0) return;
    [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
    const newIds = sorted.map(p => p.id);
    // Update positions locally
    const updatedPages = pages.map(p => {
      const newPos = newIds.indexOf(p.id);
      if (newPos !== -1) return { ...p, position: newPos } as NotePage;
      return p;
    });
    setPages(updatedPages);
    try {
      await reorderNotesAPI(newIds);
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  };

  // Move page down within subject
  const movePageDown = async (page: NotePage, index: number, total: number) => {
    if (index >= total - 1) return;
    const currentSubjectPages = pages.filter(p => p.subject === page.subject && p.title !== '__subject_placeholder__');
    const sorted = [...currentSubjectPages].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(p => p.id === page.id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    [sorted[idx], sorted[idx + 1]] = [sorted[idx + 1], sorted[idx]];
    const newIds = sorted.map(p => p.id);
    const updatedPages = pages.map(p => {
      const newPos = newIds.indexOf(p.id);
      if (newPos !== -1) return { ...p, position: newPos } as NotePage;
      return p;
    });
    setPages(updatedPages);
    try {
      await reorderNotesAPI(newIds);
    } catch (err) {
      console.error('Failed to reorder:', err);
    }
  };

  // Open AI picker modal - fetches latest AI messages
  const openAiPicker = async () => {
    setShowAiPicker(true);
    setIsLoadingAi(true);
    try {
      const saved = await getAiMessagesAPI();
      if (saved && saved.length > 0) {
        // Map and pair each assistant message with its preceding user question
        const mapped = saved.map((m: any, idx: number) => {
          let question = '';
          if (m.sender === 'assistant') {
            // Look backwards for the user question
            for (let i = idx - 1; i >= 0; i--) {
              if (saved[i].sender === 'user') {
                const q = saved[i].text;
                question = q.length > 80 ? q.substring(0, 77) + '...' : q;
                break;
              }
            }
          }
          return {
            id: m._id || m.id,
            sender: m.sender,
            text: m.text,
            createdAt: m.createdAt,
            question,
          };
        });
        // Only show assistant messages
        setAiMessages(mapped.filter((m: any) => m.sender === 'assistant'));
      } else {
        setAiMessages([]);
      }
    } catch (err) {
      console.error('Failed to fetch AI messages:', err);
      setAiMessages([]);
    } finally {
      setIsLoadingAi(false);
    }
  };

  // Save a specific AI message as a notebook note
  const addNoteFromAI = async (message: { question: string; text: string }) => {
    try {
      const parsedBlocks = markdownToBlocks(message.text);
      const title = message.question || `AI Response - ${new Date().toLocaleDateString()}`;

      // Ensure 'AI Assistant' subject exists in sidebar
      if (!subjects.includes('AI Assistant')) {
        try {
          await createSubjectAPI('AI Assistant');
        } catch (_) {
          // Subject may already exist in DB — that's fine
        }
        // Always add to local state so it shows in sidebar
        setSubjects(prev => prev.includes('AI Assistant') ? prev : [...prev, 'AI Assistant']);
      }

      const apiNote = await createNoteAPI({
        title,
        subject: 'AI Assistant',
        blocks: parsedBlocks,
        tags: ['AI Assistant'],
      });

      const newPage = mapAPINote(apiNote);
      setPages(prev => [...prev, newPage]);
      setSelectedSubject('AI Assistant');
      setSelectedPage(newPage);
      setMobileView('editor');
      setShowAiPicker(false);
    } catch (err) {
      console.error('Failed to save AI note:', err);
      alert('Failed to save AI note.');
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="page-container">
        {/* Editorial masthead — hidden on mobile when editing so the editor fills the screen */}
        <header className={`relative mb-8 pb-8 border-b border-[var(--color-border-rule)] animate-section ${mobileView !== 'list' ? 'hidden lg:block' : ''}`}>
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="flex-1 max-w-3xl">
              <p className="label !mb-3">Workspace</p>
              <h1 className="heading-hero mb-4">
                Your <span className="serif-accent">study</span>, kept close.
              </h1>
              <p className="body-lg max-w-xl text-[var(--color-text-secondary)]">
                Notes, tasks, and reference documents — organized by subject, ready when you are.
              </p>
            </div>
          </div>
        </header>

        {/* Main Layout — calm three-pane workspace */}
        <div className="workspace-shell rounded-2xl overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-280px)] min-h-[560px] bg-[var(--color-surface-white)] border border-[var(--color-border-hairline)]" style={{ boxShadow: 'var(--shadow-card)' }}>
        {/* Left Sidebar */}
        <ResizableSidebar side="left" defaultWidth={272} minWidth={220} maxWidth={420} className="lg:border-r border-[var(--color-border-hairline)] bg-[var(--color-surface-elevated)]" responsive mobileVisible={mobileView === 'list'}>
        <aside className="w-full h-full flex flex-col">
          {/* Search — quiet bar */}
          <div className="px-4 pt-5 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-soft)]" strokeWidth={1.75} />
              <input
                type="text"
                placeholder="Search pages…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-[0.8125rem] rounded-md bg-[var(--color-surface-white)] border border-[var(--color-border-hairline)] outline-none focus:border-[var(--color-navy)] transition-colors"
              />
            </div>
          </div>

          {/* Subjects & Pages */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            <div className="flex items-center justify-between px-3 mb-2 mt-1">
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-[var(--color-text-soft)]">Workspace</span>
              <button
                onClick={() => setShowNewSubjectInput(!showNewSubjectInput)}
                className="text-[var(--color-text-soft)] hover:text-[var(--color-navy)] p-1 rounded hover:bg-[var(--color-accent-soft)] transition"
                title="Add new subject"
              >
                <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>

              {/* New Subject Input — slides in */}
              {showNewSubjectInput && (
                <div className="mb-2 px-2 fade-in">
                  <div className="flex gap-1 items-center bg-[var(--color-surface-white)] border border-[var(--color-navy)] rounded-md px-2 py-1.5">
                    <FolderPlus className="w-3.5 h-3.5 text-[var(--color-text-soft)] shrink-0" strokeWidth={1.75} />
                    <input
                      type="text"
                      value={newSubjectName}
                      onChange={(e) => setNewSubjectName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newSubjectName.trim()) {
                          try {
                            await createSubjectAPI(newSubjectName.trim());
                            setSubjects([...subjects, newSubjectName.trim()]);
                            setSelectedSubject(newSubjectName.trim());
                            setNewSubjectName('');
                            setShowNewSubjectInput(false);
                          } catch (err: any) {
                            console.error('Failed to create subject:', err);
                            alert(err?.response?.data?.message || 'Failed to create subject');
                          }
                        } else if (e.key === 'Escape') {
                          setNewSubjectName('');
                          setShowNewSubjectInput(false);
                        }
                      }}
                      placeholder="New subject"
                      className="flex-1 bg-transparent border-none outline-none text-[0.8125rem] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-soft)]"
                      autoFocus
                    />
                    <button
                      onClick={() => { setNewSubjectName(''); setShowNewSubjectInput(false); }}
                      className="text-[var(--color-text-soft)] hover:text-red-500 p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}

              {subjects.map(subject => {
                const subjectPageCount = filteredPages.filter(p => p.subject === subject).length;
                const isExpanded = selectedSubject === subject;
                const isRenaming = renamingSubject === subject;
                const accent = accentForSubject(subject);
                const accentVars = { '--nb-accent': accent.dot, '--nb-accent-soft': accent.soft } as React.CSSProperties;

                return (
                  <div key={subject} className="mb-2" style={accentVars}>
                    {isRenaming ? (
                      <div className="flex items-center gap-2 px-3 py-2.5 bg-[var(--color-surface-white)] rounded-xl border" style={{ borderColor: accent.dot }}>
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: accent.dot }} />
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && renameValue.trim() && renameValue.trim() !== subject) {
                              try {
                                await renameSubjectAPI(subject, renameValue.trim());
                                const newName = renameValue.trim();
                                setSubjects(subjects.map(s => s === subject ? newName : s));
                                setPages(pages.map(p => p.subject === subject ? { ...p, subject: newName } : p));
                                if (selectedSubject === subject) setSelectedSubject(newName);
                                if (selectedPage?.subject === subject) setSelectedPage({ ...selectedPage, subject: newName });
                                setRenamingSubject(null);
                              } catch (err: any) {
                                alert(err?.response?.data?.message || 'Failed to rename subject');
                              }
                            } else if (e.key === 'Enter' && renameValue.trim() === subject) {
                              setRenamingSubject(null);
                            } else if (e.key === 'Escape') {
                              setRenamingSubject(null);
                            }
                          }}
                          onBlur={async () => {
                            if (renameValue.trim() && renameValue.trim() !== subject) {
                              try {
                                await renameSubjectAPI(subject, renameValue.trim());
                                const newName = renameValue.trim();
                                setSubjects(subjects.map(s => s === subject ? newName : s));
                                setPages(pages.map(p => p.subject === subject ? { ...p, subject: newName } : p));
                                if (selectedSubject === subject) setSelectedSubject(newName);
                                if (selectedPage?.subject === subject) setSelectedPage({ ...selectedPage, subject: newName });
                              } catch (err: any) {
                                console.error('Failed to rename subject:', err);
                              }
                            }
                            setRenamingSubject(null);
                          }}
                          className="flex-1 min-w-0 bg-transparent border-none outline-none text-[0.8125rem] font-semibold text-[var(--color-text-primary)]"
                        />
                      </div>
                    ) : (
                    <div className="nb-card group/subject" data-active={isExpanded}>
                      <div onClick={() => setSelectedSubject(subject)} className="nb-card-head">
                        <span className="nb-card-icon">
                          {isExpanded
                            ? <FolderOpen className="w-3.5 h-3.5" strokeWidth={1.75} />
                            : <Folder className="w-3.5 h-3.5" strokeWidth={1.75} />}
                        </span>
                        <span className="nb-card-title">{subject}</span>
                        <span className="nb-card-actions">
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingSubject(subject);
                              setRenameValue(subject);
                              setTimeout(() => renameInputRef.current?.focus(), 50);
                            }}
                            className="nb-handle-btn"
                            title="Rename"
                          >
                            <Pencil className="w-3 h-3" strokeWidth={1.75} />
                          </span>
                          <span
                            role="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteSubjectTarget(subject);
                            }}
                            className="nb-handle-btn hover:!text-red-500"
                            title="Delete"
                          >
                            <X className="w-3 h-3" strokeWidth={1.75} />
                          </span>
                        </span>
                        <span className="nb-card-count group-hover/subject:hidden">{subjectPageCount}</span>
                        <ChevronDown className="nb-card-chev w-3.5 h-3.5" data-expanded={isExpanded} strokeWidth={2} />
                      </div>

                      {/* Pages under this subject */}
                      {isExpanded && (
                        <div className="nb-card-body fade-in">
                          {subjectPages.map((page, idx) => {
                            const isPageActive = selectedPage?.id === page.id;
                            return (
                            <div
                              key={page.id}
                              onClick={() => { setSelectedPage(page); setMobileView('editor'); }}
                              data-active={isPageActive}
                              className="nb-row group/page"
                            >
                              <FileText className="w-3.5 h-3.5 text-[var(--color-text-soft)] shrink-0" strokeWidth={1.5} />
                              <span className="text-[0.8125rem] truncate flex-1 tracking-tight">
                                {page.title || 'Untitled'}
                              </span>
                              <span className="nb-row-actions">
                                <span
                                  role="button"
                                  onClick={(e) => { e.stopPropagation(); movePageUp(page, idx); }}
                                  className={`nb-handle-btn ${idx === 0 ? 'pointer-events-none opacity-30' : ''}`}
                                  title="Move up"
                                >
                                  <ChevronUp className="w-3 h-3" strokeWidth={2} />
                                </span>
                                <span
                                  role="button"
                                  onClick={(e) => { e.stopPropagation(); movePageDown(page, idx, subjectPages.length); }}
                                  className={`nb-handle-btn ${idx === subjectPages.length - 1 ? 'pointer-events-none opacity-30' : ''}`}
                                  title="Move down"
                                >
                                  <ChevronDown className="w-3 h-3" strokeWidth={2} />
                                </span>
                                <span
                                  role="button"
                                  onClick={(e) => { e.stopPropagation(); setDeletePageTarget(page); }}
                                  className="nb-handle-btn hover:!text-red-500"
                                  title="Delete page"
                                >
                                  <X className="w-3 h-3" strokeWidth={2} />
                                </span>
                              </span>
                            </div>
                            );
                          })}

                          {subjectPages.length === 0 && (
                            <p className="px-2 py-1.5 text-[11px] text-[var(--color-text-soft)] italic" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
                              No pages yet.
                            </p>
                          )}

                          <div
                            onClick={createNewPage}
                            className="nb-row text-[var(--color-text-soft)] hover:text-[var(--color-navy)]"
                          >
                            <Plus className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                            <span className="text-[0.8125rem] italic" style={{ fontFamily: 'var(--font-fraunces), serif' }}>New page</span>
                          </div>
                        </div>
                      )}
                    </div>
                    )}
                  </div>
                );
              })}

              {/* Loading skeleton while folders fetch */}
              {isLoading && subjects.length === 0 && (
                <div className="px-2 space-y-2">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="skeleton h-9 w-full rounded-xl" style={{ opacity: 1 - i * 0.25 }} />
                  ))}
                </div>
              )}

              {/* Empty state — no folders yet */}
              {!isLoading && subjects.length === 0 && !showNewSubjectInput && (
                <button
                  onClick={() => setShowNewSubjectInput(true)}
                  className="w-full mt-1 px-4 py-6 rounded-xl border border-dashed border-[var(--color-border-hairline)] flex flex-col items-center gap-2 text-[var(--color-text-soft)] hover:border-[var(--color-navy)] hover:text-[var(--color-navy)] hover:bg-[var(--color-accent-soft)] transition-all group/empty"
                >
                  <FolderPlus className="w-5 h-5 transition-transform group-hover/empty:scale-110" strokeWidth={1.5} />
                  <span className="text-[0.8125rem] font-semibold tracking-tight">Create your first folder</span>
                  <span className="text-[11px] italic leading-relaxed max-w-[180px]" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
                    Organise your notes by subject — Anatomy, Pathology, anything you like.
                  </span>
                </button>
              )}
          </div>

          {/* Add Note from AI Button — refined inline */}
          <div className="px-3 pb-4 pt-3 border-t border-[var(--color-border-hairline)] space-y-2">
            <button
              onClick={openAiPicker}
              className="w-full px-3 py-2.5 rounded-md text-[0.8125rem] font-semibold flex items-center justify-center gap-2 transition-all gradient-ink text-white hover:brightness-110"
              style={{ boxShadow: 'var(--shadow-btn), var(--shadow-inset)' }}
            >
              <Bot className="w-3.5 h-3.5" strokeWidth={1.75} /> Add note from AI
            </button>
            {/* Mobile-only shortcut to tasks/documents pane */}
            <button
              onClick={() => setMobileView('tools')}
              className="lg:hidden w-full px-3 py-2 rounded-md text-[0.8125rem] font-semibold flex items-center justify-center gap-2 bg-[var(--color-surface-white)] border border-[var(--color-border-hairline)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-navy)] transition-smooth"
            >
              <Wrench className="w-3.5 h-3.5" strokeWidth={1.75} /> Tasks & documents
            </button>
          </div>
        </aside>
        </ResizableSidebar>

        {/* Main Editor Area — calm paper canvas */}
        <main className={`flex-1 overflow-y-auto bg-[var(--color-surface-white)] ${mobileView === 'editor' ? 'block' : 'hidden'} lg:block`}>
          {/* Mobile back-bar */}
          <div className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-3 py-2.5 bg-white/95 backdrop-blur border-b border-[var(--color-border-hairline)]">
            <button
              onClick={() => setMobileView('list')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-navy)] transition-smooth"
              aria-label="Back to pages"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate flex-1 text-center px-2">
              {selectedPage?.title || 'Untitled'}
            </span>
            <button
              onClick={() => setMobileView('tools')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] bg-[var(--color-surface-muted)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-navy)] transition-smooth"
              aria-label="Tasks and documents"
              title="Tasks & documents"
            >
              <Wrench className="w-4 h-4" />
            </button>
          </div>
          {selectedPage ? (
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-14 py-6 lg:py-16 fade-in">
              {/* Editable Page Title */}
              <input
                type="text"
                value={selectedPage.title}
                onChange={(e) => updatePageTitle(e.target.value)}
                className="nb-title nb-input mb-3 placeholder:opacity-40"
                placeholder="Untitled"
              />

              {/* Metadata — quiet editorial spec */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-10 pb-6 border-b border-[var(--color-border-hairline)] text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--color-text-soft)]">
                <span className="flex items-center gap-1.5">
                  <Folder className="w-3 h-3" strokeWidth={1.75} /> {selectedPage.subject}
                </span>
                <span className="w-1 h-1 rounded-full bg-[var(--color-border-strong)]" />
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" strokeWidth={1.75} /> Updated {new Date(selectedPage.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
                {selectedPage.tags && selectedPage.tags.length > 0 && (
                  <>
                    <span className="w-1 h-1 rounded-full bg-[var(--color-border-strong)]" />
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3 h-3" strokeWidth={1.75} /> {selectedPage.tags.join(' · ')}
                    </span>
                  </>
                )}
              </div>

              {/* Blocks — Notion-style with hover handles */}
              <div className="space-y-1">
                {selectedPage.blocks.map((block) => (
                  <div key={block.id} className="nb-block">
                    <div className="nb-handle">
                      <span
                        role="button"
                        onClick={() => deleteBlock(block.id)}
                        className="nb-handle-btn hover:!text-red-500"
                        title="Delete block"
                      >
                        <Trash2 className="w-3 h-3" strokeWidth={1.75} />
                      </span>
                    </div>

                    {block.type === 'heading' && (
                      <input
                        type="text"
                        value={block.text}
                        onChange={(e) => updateBlockText(block.id, e.target.value)}
                        className="nb-input nb-h"
                        placeholder="Heading"
                      />
                    )}

                    {block.type === 'text' && (
                      <textarea
                        value={block.text}
                        onChange={(e) => updateBlockText(block.id, e.target.value)}
                        className="nb-textarea nb-body resize-none"
                        placeholder="Type ‘/’ or just start writing…"
                        rows={Math.max(2, (block.text.match(/\n/g) || []).length + 1)}
                      />
                    )}

                    {block.type === 'checklist' && (
                      <div className="flex items-center gap-3 py-0.5">
                        <input
                          type="checkbox"
                          checked={block.checked || false}
                          onChange={() => toggleChecklist(block.id)}
                          className="nb-checkbox"
                        />
                        <input
                          type="text"
                          value={block.text}
                          onChange={(e) => updateBlockText(block.id, e.target.value)}
                          className={`nb-input nb-body flex-1 ${block.checked ? 'line-through text-[var(--color-text-soft)]' : ''}`}
                          placeholder="To-do"
                        />
                      </div>
                    )}

                    {block.type === 'bullet' && (
                      <div className="flex items-baseline gap-3 py-0.5">
                        <span className="text-[var(--color-text-muted)] font-bold leading-none mt-1.5 shrink-0">·</span>
                        <input
                          type="text"
                          value={block.text}
                          onChange={(e) => updateBlockText(block.id, e.target.value)}
                          className="nb-input nb-body flex-1"
                          placeholder="List item"
                        />
                      </div>
                    )}

                    {block.type === 'divider' && (
                      <div className="my-5 flex items-center justify-center" aria-hidden>
                        <span className="text-[var(--color-text-soft)] text-xs tracking-[0.4em] select-none">· · ·</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add Block Menu — slash-command vibe */}
              <div className="mt-8 relative">
                <button
                  onClick={() => setShowBlockMenu(!showBlockMenu)}
                  className="text-[var(--color-text-soft)] hover:text-[var(--color-navy)] text-sm flex items-center gap-2 py-2 px-2 -mx-2 rounded-md hover:bg-[var(--color-surface-elevated)] transition group/add"
                >
                  <span className="w-5 h-5 rounded border border-[var(--color-border-rule)] flex items-center justify-center group-hover/add:border-[var(--color-navy)] transition">
                    <Plus className="w-3 h-3" strokeWidth={2.25} />
                  </span>
                  <span className="text-[0.8125rem]">Add a block</span>
                  <kbd className="nb-kbd ml-1">/</kbd>
                </button>

                {showBlockMenu && (
                  <div className="absolute left-0 top-full mt-2 nb-menu z-10 fade-in">
                    <div className="px-3 py-2 border-b border-[var(--color-border-hairline)]">
                      <p className="label !mb-0">Basic blocks</p>
                    </div>
                    {[
                      { type: 'heading' as const, label: 'Heading', desc: 'Section title', Icon: Heading, kbd: 'H' },
                      { type: 'text' as const, label: 'Text', desc: 'Plain paragraph', Icon: Type, kbd: 'T' },
                      { type: 'checklist' as const, label: 'To-do list', desc: 'Track tasks', Icon: CheckSquare, kbd: '☐' },
                      { type: 'bullet' as const, label: 'Bullet list', desc: 'Simple list', Icon: List, kbd: '·' },
                      { type: 'divider' as const, label: 'Divider', desc: 'Visual break', Icon: Minus, kbd: '—' },
                    ].map(({ type, label, desc, Icon, kbd }) => (
                      <button
                        key={type}
                        onClick={() => addBlock(type)}
                        className="nb-menu-item"
                      >
                        <span className="nb-menu-icon">
                          <Icon className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-[0.8125rem] font-semibold text-[var(--color-navy)] tracking-tight">{label}</span>
                          <span className="block text-[11px] text-[var(--color-text-soft)]">{desc}</span>
                        </span>
                        <kbd className="nb-kbd">{kbd}</kbd>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="max-w-md mx-auto px-6 py-24 text-center fade-in">
              <div className="w-16 h-16 mx-auto mb-6 rounded-full border border-[var(--color-border-rule)] flex items-center justify-center dot-grid">
                <PenLine className="w-6 h-6 text-[var(--color-text-muted)]" strokeWidth={1.25} />
              </div>
              <h2
                className="mb-2 text-[var(--color-navy)]"
                style={{
                  fontFamily: 'var(--font-fraunces), serif',
                  fontSize: '1.5rem',
                  fontWeight: 500,
                  letterSpacing: '-0.025em',
                }}
              >
                A <span className="serif-accent">blank</span> page awaits.
              </h2>
              <p className="body-md mb-7 max-w-xs mx-auto">
                Pick a page from the side, or start something new — your study, organized.
              </p>
              <button onClick={createNewPage} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                New page
              </button>
            </div>
          )}
        </main>

        {/* Right Sidebar — Tasks & Uploads */}
        <ResizableSidebar side="right" defaultWidth={320} minWidth={240} maxWidth={500} className="lg:border-l border-[var(--color-border-hairline)] bg-[var(--color-surface-elevated)]" responsive mobileVisible={mobileView === 'tools'}>
        <aside className="w-full h-full flex flex-col overflow-y-auto">
          {/* Mobile back-bar */}
          <div className="lg:hidden sticky top-0 z-20 flex items-center gap-2 px-3 py-2.5 bg-[var(--color-surface-elevated)] border-b border-[var(--color-border-hairline)]">
            <button
              onClick={() => setMobileView(selectedPage ? 'editor' : 'list')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] bg-[var(--color-surface-white)] hover:bg-[var(--color-accent-soft)] hover:text-[var(--color-navy)] transition-smooth border border-[var(--color-border-hairline)]"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">Tasks & documents</span>
          </div>

          {/* Tasks Section */}
          <div className="px-5 pt-5 pb-6 border-b border-[var(--color-border-hairline)]">
            <div className="flex items-baseline justify-between mb-4">
              <div>
                <p className="label !mb-0.5">Today</p>
                <h2
                  className="text-[var(--color-navy)]"
                  style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '1.125rem', fontWeight: 500, letterSpacing: '-0.02em' }}
                >
                  Tasks
                </h2>
              </div>
              <span
                className="text-[var(--color-text-soft)] tabular-nums"
                style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '0.9375rem', fontStyle: 'italic' }}
              >
                {tasks.filter(t => !t.completed).length}/{tasks.length}
              </span>
            </div>

            {/* Task List */}
            <div className="space-y-1 mb-4">
              {tasks.length === 0 ? (
                <p className="text-[0.8125rem] text-[var(--color-text-soft)] italic px-1 py-2" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
                  Nothing to do — yet.
                </p>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="flex items-center gap-2.5 group py-1 px-1 -mx-1 rounded-md hover:bg-[var(--color-surface-white)] transition">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => toggleTask(task.id)}
                      className="nb-checkbox"
                    />
                    <span className={`flex-1 text-[0.8125rem] tracking-tight ${task.completed ? 'line-through text-[var(--color-text-soft)]' : 'text-[var(--color-text-primary)]'}`}>
                      {task.title}
                    </span>
                    <button
                      onClick={() => deleteTask(task.id)}
                      className="opacity-0 group-hover:opacity-100 text-[var(--color-text-soft)] hover:text-red-500 transition p-0.5 rounded"
                    >
                      <X className="w-3 h-3" strokeWidth={2} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Task */}
            <div className="flex gap-1.5 items-center bg-[var(--color-surface-white)] border border-[var(--color-border-hairline)] rounded-md px-2.5 py-1.5 focus-within:border-[var(--color-navy)] transition-colors">
              <Plus className="w-3.5 h-3.5 text-[var(--color-text-soft)] shrink-0" strokeWidth={1.75} />
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addTask()}
                placeholder="Add a task…"
                className="flex-1 bg-transparent border-none outline-none text-[0.8125rem] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-soft)]"
              />
              {newTaskTitle && (
                <button
                  onClick={addTask}
                  className="text-[10px] uppercase tracking-wider font-bold text-[var(--color-blue-primary)] hover:text-[var(--color-navy)] transition"
                >
                  Add
                </button>
              )}
            </div>
          </div>

          {/* Documents Section */}
          <div className="px-5 pt-6 pb-5 flex-1">
            <div className="mb-4">
              <p className="label !mb-0.5">Reference</p>
              <h2
                className="text-[var(--color-navy)]"
                style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '1.125rem', fontWeight: 500, letterSpacing: '-0.02em' }}
              >
                Documents
              </h2>
            </div>

            {/* File Upload — refined dropzone */}
            <label className="nb-dropzone mb-4">
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.75} />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" strokeWidth={1.75} />
                  <span>Drop files or click to upload</span>
                </>
              )}
              <input type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.csv,.xls,.xlsx,.txt,.rtf,.odt,.ods,.odp" disabled={isUploading} />
            </label>

            {/* Documents List */}
            <div className="space-y-1">
              {uploadedFiles.map(file => (
                <div key={file.id} className="relative group">
                  <button
                    onClick={() => openDocumentPreview(file)}
                    className="nb-doc w-full"
                  >
                    <span className="nb-doc-icon">
                      {getFileIcon(file.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.8125rem] font-semibold text-[var(--color-text-primary)] truncate tracking-tight">
                        {file.name}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-soft)] font-semibold">
                        <span>{file.type}</span>
                        <span className="w-0.5 h-0.5 rounded-full bg-[var(--color-border-strong)]" />
                        <span>{file.uploadedAt}</span>
                      </div>
                    </div>
                    <Eye className="w-3.5 h-3.5 text-[var(--color-text-soft)] opacity-0 group-hover:opacity-100 transition shrink-0" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      try {
                        await deleteDocumentAPI(file.id);
                        setUploadedFiles(uploadedFiles.filter(f => f.id !== file.id));
                      } catch (err) {
                        console.error('Failed to delete document:', err);
                      }
                    }}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-[var(--color-text-soft)] hover:text-red-500 transition bg-[var(--color-surface-white)] border border-[var(--color-border-hairline)] rounded p-0.5"
                  >
                    <X className="w-3 h-3" strokeWidth={2} />
                  </button>
                </div>
              ))}

              {uploadedFiles.length === 0 && (
                <div className="text-center py-8">
                  <Inbox className="w-8 h-8 mx-auto mb-2 text-[var(--color-border-strong)]" strokeWidth={1.25} />
                  <p className="text-[0.8125rem] text-[var(--color-text-soft)] italic" style={{ fontFamily: 'var(--font-fraunces), serif' }}>
                    No documents — yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </aside>
        </ResizableSidebar>
      </div>

      {/* Document Preview Modal */}
      {previewDocument && (
        <div
          className="fixed inset-0 bg-[rgba(0,11,51,0.4)] backdrop-blur-sm flex items-center justify-center z-50 p-4 fade-in"
          onClick={closeDocumentPreview}
        >
          <div
            className="bg-[var(--color-surface-white)] rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-[var(--color-border-hairline)]"
            style={{ boxShadow: 'var(--shadow-modal)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-hairline)] bg-[var(--color-surface-elevated)]">
              <div className="flex items-center gap-3 min-w-0">
                <span className="nb-doc-icon shrink-0">{getFileIcon(previewDocument.type)}</span>
                <div className="min-w-0">
                  <h3
                    className="text-[var(--color-navy)] truncate"
                    style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '1.125rem', fontWeight: 500, letterSpacing: '-0.02em' }}
                  >
                    {previewDocument.name}
                  </h3>
                  <p className="text-[11px] uppercase tracking-[0.16em] font-semibold text-[var(--color-text-soft)] mt-0.5">
                    {previewDocument.type.toUpperCase()} · {previewDocument.uploadedAt}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewDocument.url && (
                  <a href={previewDocument.url} download={previewDocument.name} className="btn-primary inline-flex items-center gap-1.5 !py-2 !px-3.5">
                    <Download className="w-3.5 h-3.5" strokeWidth={2} /> Download
                  </a>
                )}
                <button onClick={closeDocumentPreview} className="btn-secondary inline-flex items-center gap-1.5 !py-2 !px-3.5">
                  <X className="w-3.5 h-3.5" strokeWidth={2} /> Close
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-hidden bg-[var(--color-surface-elevated)]">
              {previewDocument.url && previewDocument.type === 'pdf' ? (
                <embed src={previewDocument.url} type="application/pdf" className="w-full h-full" title={previewDocument.name} />
              ) : previewDocument.url && previewDocument.type === 'image' ? (
                <div className="flex items-center justify-center h-full p-6 overflow-auto">
                  <img src={previewDocument.url} alt={previewDocument.name} className="max-w-full max-h-full object-contain rounded-lg" style={{ boxShadow: 'var(--shadow-card)' }} />
                </div>
              ) : previewDocument.url && previewDocument.type === 'csv' ? (
                <CsvPreview url={previewDocument.url} />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                  <div className="text-center max-w-md">
                    <div className="mb-5 flex justify-center [&_svg]:w-12 [&_svg]:h-12">{getFileIcon(previewDocument.type)}</div>
                    <h3
                      className="text-[var(--color-navy)] mb-2"
                      style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '1.25rem', fontWeight: 500, letterSpacing: '-0.022em' }}
                    >
                      Preview unavailable
                    </h3>
                    <p className="body-md mb-6">This file type can&apos;t be shown inline — but you can grab it.</p>
                    {previewDocument.url && (
                      <a href={previewDocument.url} download={previewDocument.name} className="btn-primary inline-flex items-center gap-2">
                        <Download className="w-4 h-4" strokeWidth={2} /> Download file
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Page Confirmation */}
      <ConfirmModal
        open={!!deletePageTarget}
        title="Delete Page?"
        message={`This will permanently delete "${deletePageTarget?.title}". This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deletePageTarget) return;
          try {
            await deleteNoteAPI(deletePageTarget.id);
            setPages(pages.filter(p => p.id !== deletePageTarget.id));
            if (selectedPage?.id === deletePageTarget.id) {
              setSelectedPage(null);
              setMobileView('list');
            }
          } catch (err) {
            console.error('Failed to delete page:', err);
          } finally {
            setDeletePageTarget(null);
          }
        }}
        onCancel={() => setDeletePageTarget(null)}
      />

      {/* AI Messages Picker Modal */}
      {showAiPicker && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(0,11,51,0.4)] backdrop-blur-sm p-4 fade-in"
          onClick={() => setShowAiPicker(false)}
        >
          <div
            className="bg-[var(--color-surface-white)] rounded-2xl w-full max-w-xl max-h-[75vh] flex flex-col overflow-hidden border border-[var(--color-border-hairline)]"
            style={{ boxShadow: 'var(--shadow-modal)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-7 pt-6 pb-5 border-b border-[var(--color-border-hairline)] flex items-start justify-between gap-4">
              <div>
                <p className="label !mb-2">From the AI</p>
                <h3
                  className="text-[var(--color-navy)] mb-1"
                  style={{
                    fontFamily: 'var(--font-fraunces), serif',
                    fontSize: '1.625rem',
                    fontWeight: 500,
                    letterSpacing: '-0.03em',
                    lineHeight: 1.1,
                  }}
                >
                  Save a <span className="serif-accent">response</span> as a note.
                </h3>
                <p className="text-[0.8125rem] text-[var(--color-text-muted)] mt-2">
                  Picks land in the &ldquo;AI Assistant&rdquo; section, formatted as blocks.
                </p>
              </div>
              <button
                onClick={() => setShowAiPicker(false)}
                className="text-[var(--color-text-soft)] hover:text-[var(--color-navy)] hover:bg-[var(--color-surface-elevated)] p-2 rounded-md transition shrink-0"
              >
                <X className="w-4 h-4" strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {isLoadingAi ? (
                <div className="space-y-2.5 py-2">
                  {[0, 1, 2, 3].map(i => (
                    <div key={i} className="card-item p-4" style={{ opacity: 1 - i * 0.2 }}>
                      <div className="skeleton h-3 w-32 mb-2.5" />
                      <div className="skeleton h-2.5 w-full mb-1.5" />
                      <div className="skeleton h-2.5 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : aiMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <div className="w-14 h-14 mb-4 rounded-full border border-[var(--color-border-rule)] flex items-center justify-center dot-grid">
                    <Bot className="w-5 h-5 text-[var(--color-text-muted)]" strokeWidth={1.25} />
                  </div>
                  <p
                    className="text-[var(--color-navy)] mb-1"
                    style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '1.0625rem', fontWeight: 500 }}
                  >
                    No conversations yet.
                  </p>
                  <p className="text-[0.8125rem] text-[var(--color-text-soft)] max-w-xs">
                    Chat with the AI Assistant first to generate responses you can save here.
                  </p>
                </div>
              ) : (
                aiMessages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => addNoteFromAI(msg)}
                    className="w-full text-left p-4 rounded-lg border border-[var(--color-border-hairline)] hover:border-[var(--color-navy)] bg-[var(--color-surface-white)] hover:bg-[var(--color-surface-elevated)] transition-all group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-[var(--color-navy)] mb-1.5 truncate"
                          style={{ fontFamily: 'var(--font-fraunces), serif', fontSize: '0.9375rem', fontWeight: 500, letterSpacing: '-0.018em' }}
                        >
                          {msg.question || 'AI Response'}
                        </p>
                        <p className="text-[0.8125rem] text-[var(--color-text-body)] line-clamp-2 leading-relaxed">
                          {msg.text.replace(/[#*_~`>]/g, '').substring(0, 200)}
                          {msg.text.length > 200 ? '…' : ''}
                        </p>
                        <p className="text-[10px] uppercase tracking-[0.16em] text-[var(--color-text-soft)] mt-2 font-semibold">
                          {new Date(msg.createdAt).toLocaleDateString()} · {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <span className="w-7 h-7 rounded-md border border-[var(--color-border-hairline)] flex items-center justify-center text-[var(--color-text-soft)] group-hover:bg-[var(--color-navy)] group-hover:text-white group-hover:border-[var(--color-navy)] transition shrink-0">
                        <Plus className="w-3.5 h-3.5" strokeWidth={2} />
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Subject Confirmation */}
      <ConfirmModal
        open={!!deleteSubjectTarget}
        title="Delete Subject?"
        message={`This will permanently delete "${deleteSubjectTarget}" and all its pages. This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleteSubjectTarget) return;
          try {
            await deleteSubjectAPI(deleteSubjectTarget);
            setSubjects(subjects.filter(s => s !== deleteSubjectTarget));
            setPages(pages.filter(p => p.subject !== deleteSubjectTarget));
            if (selectedSubject === deleteSubjectTarget) {
              const remaining = subjects.filter(s => s !== deleteSubjectTarget);
              setSelectedSubject(remaining[0] || '');
              setSelectedPage(null);
              setMobileView('list');
            }
          } catch (err) {
            console.error('Failed to delete subject:', err);
          } finally {
            setDeleteSubjectTarget(null);
          }
        }}
        onCancel={() => setDeleteSubjectTarget(null)}
      />
    </div>
    </div>
  );
}
