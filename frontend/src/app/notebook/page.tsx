'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  FolderOpen, Folder, FileText, Search, Trash2, CheckSquare, BookOpen,
  Upload, Eye, X, Inbox, PenLine, Bot, Tag, Heading, Type, List, Minus,
  Paperclip, Presentation, FileEdit, Calendar, Loader2, Plus, FolderPlus,
  Image, Table, File, Pencil, ChevronUp, ChevronDown
} from 'lucide-react';
import { getNotesAPI, createNoteAPI, updateNoteAPI, deleteNoteAPI, getTasksAPI, createTaskAPI, toggleTaskAPI, deleteTaskAPI, getSubjectsAPI, createSubjectAPI, renameSubjectAPI, deleteSubjectAPI, getDocumentsAPI, uploadDocumentAPI, downloadDocumentAPI, deleteDocumentAPI, getAiMessagesAPI, reorderNotesAPI } from '@/lib/api';
import ResizableSidebar from '@/components/ResizableSidebar';
import ConfirmModal from '@/components/ConfirmModal';

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

  if (rows.length === 0) return <div className="flex items-center justify-center h-full text-slate-400">Loading...</div>;

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
  const [selectedSubject, setSelectedSubject] = useState<string>('Anatomy');
  const [searchQuery, setSearchQuery] = useState('');
  const [showBlockMenu, setShowBlockMenu] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [subjects, setSubjects] = useState<string[]>(['Anatomy', 'Pathology', 'Pharmacology', 'Surgery']);
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
        if (subjectsData && subjectsData.length > 0) {
          setSubjects(subjectsData);
        }
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

  // Parse markdown text into notebook blocks
  const parseMarkdownToBlocks = (text: string) => {
    const lines = text.split('\n');
    const blocks: { type: 'heading' | 'text' | 'bullet' | 'checklist' | 'divider'; text: string; checked?: boolean }[] = [];
    let currentTextLines: string[] = [];

    const flushText = () => {
      if (currentTextLines.length > 0) {
        const content = currentTextLines.join('\n').trim();
        if (content) {
          blocks.push({ type: 'text', text: content });
        }
        currentTextLines = [];
      }
    };

    for (const line of lines) {
      if (line.trim() === '') {
        flushText();
        continue;
      }

      // Headings: # Heading, ## Heading, ### Heading
      if (/^#{1,3}\s+/.test(line)) {
        flushText();
        const headingText = line.replace(/^#{1,3}\s+/, '').replace(/\*\*/g, '');
        blocks.push({ type: 'heading', text: headingText });
        continue;
      }

      // Bold-only lines as headings: **Some Title**
      if (/^\*\*[^*]+\*\*[:\s]*$/.test(line)) {
        flushText();
        const headingText = line.replace(/^\*\*/, '').replace(/\*\*[:\s]*$/, '').trim();
        blocks.push({ type: 'heading', text: headingText });
        continue;
      }

      // Dividers: ---, ***, ___
      if (/^[-*_]{3,}$/.test(line)) {
        flushText();
        blocks.push({ type: 'divider', text: '' });
        continue;
      }

      // Checklist items: - [ ] or - [x]
      if (/^[-*]\s*\[[ xX]\]\s+/.test(line)) {
        flushText();
        const checked = /\[[xX]\]/.test(line);
        const itemText = line.replace(/^[-*]\s*\[[ xX]\]\s+/, '').replace(/\*\*/g, '');
        blocks.push({ type: 'checklist', text: itemText, checked });
        continue;
      }

      // Bullet points: - item, * item, • item, or numbered 1. item
      if (/^[-*•]\s+/.test(line) || /^\d+[.)\s]\s*/.test(line)) {
        flushText();
        const bulletText = line
          .replace(/^[-*•]\s+/, '')
          .replace(/^\d+[.)\s]\s*/, '')
          .replace(/\*\*/g, '');
        blocks.push({ type: 'bullet', text: bulletText });
        continue;
      }

      // Regular text line
      currentTextLines.push(line.replace(/\*\*/g, ''));
    }

    flushText();

    if (blocks.length === 0) {
      blocks.push({ type: 'text', text: text.replace(/\*\*/g, '') });
    }

    return blocks;
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
      const parsedBlocks = parseMarkdownToBlocks(message.text);
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
      setShowAiPicker(false);
    } catch (err) {
      console.error('Failed to save AI note:', err);
      alert('Failed to save AI note.');
    }
  };

  return (
    <div className="min-h-screen gradient-subtle">
      <div className="page-container">
        {/* Page Header */}
        <div className="card rounded-3xl p-6 md:p-8 mb-6 animate-section">
          <p className="label mb-2">Workspace</p>
          <h1 className="heading-2 mb-2 fade-in-up">My Workspace</h1>
          <p className="body-md fade-in-delay-1">Organize your medical study notes, tasks, and resources</p>
        </div>

        {/* Main Layout */}
        <div className="card rounded-3xl overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-280px)] min-h-[560px]">
        {/* Left Sidebar */}
        <ResizableSidebar side="left" defaultWidth={256} minWidth={200} maxWidth={400} responsive>
        <aside className="w-full h-full card flex flex-col">
          {/* Search */}
          <div className="p-4 border-b border-[var(--color-border-light)]">
            <div className="relative">
              <input type="text" placeholder="Search pages..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="input pl-8" />
              <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
            </div>
          </div>

          {/* Subjects & Pages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-4">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                My Workspace
              </div>
            </div>

            <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Subjects</div>
                <button onClick={() => setShowNewSubjectInput(!showNewSubjectInput)} className="btn-secondary p-1" title="Add new subject">
                  <FolderPlus className="w-4 h-4" />
                </button>
              </div>

              {/* New Subject Input */}
              {showNewSubjectInput && (
                      <div className="mb-3">
                  <div className="flex gap-1">
                    <input type="text" value={newSubjectName} onChange={(e) => setNewSubjectName(e.target.value)} onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newSubjectName.trim()) {
                          try {
                            await createSubjectAPI(newSubjectName.trim());
                            setSubjects([...subjects, newSubjectName.trim()]);
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
                      }} placeholder="Subject name..." className="input" autoFocus />
                    <button onClick={async () => { if (!newSubjectName.trim()) return; try { await createSubjectAPI(newSubjectName.trim()); setSubjects([...subjects, newSubjectName.trim()]); setNewSubjectName(''); setShowNewSubjectInput(false); } catch (err: any) { console.error('Failed to create subject:', err); alert(err?.response?.data?.message || 'Failed to create subject'); } }} className="btn-primary px-2 py-1.5">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {subjects.map(subject => {
                const subjectPageCount = filteredPages.filter(p => p.subject === subject).length;
                const isExpanded = selectedSubject === subject;
                const isRenaming = renamingSubject === subject;

                return (
                  <div key={subject} className="mb-2 group/subject">
                    {isRenaming ? (
                      <div className="flex items-center gap-1 px-3 py-1.5">
                        <Folder className="w-4 h-4 text-[var(--color-blue-primary)] flex-shrink-0" />
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
                          className="flex-1 min-w-0 px-2 py-0.5 text-sm input"
                        />
                      </div>
                    ) : (
                    <button
                      onClick={() => setSelectedSubject(subject)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition ${isExpanded ? 'bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)]' : 'text-[var(--color-text-primary)] hover:bg-slate-50'
                        }`}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {isExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                        {subject}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-xs text-gray-500">{subjectPageCount}</span>
                        <span
                          role="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingSubject(subject);
                            setRenameValue(subject);
                            setTimeout(() => renameInputRef.current?.focus(), 50);
                          }}
                          className="opacity-0 group-hover/subject:opacity-100 text-slate-400 hover:text-[var(--color-blue-primary)] transition ml-1"
                          title="Rename subject"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </span>
                        <span
                          role="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setDeleteSubjectTarget(subject);
                          }}
                          className="opacity-0 group-hover/subject:opacity-100 text-slate-400 hover:text-red-600 transition"
                          title="Delete subject"
                        >
                          <X className="w-3.5 h-3.5" />
                        </span>
                      </span>
                    </button>
                    )}

                    {/* Pages under this subject */}
                    {isExpanded && (
                      <div className="ml-6 mt-1 space-y-1">
                        {subjectPages.map((page, idx) => (
                          <div key={page.id} className="group/page flex items-center">
                            <button
                              onClick={() => setSelectedPage(page)}
                              className={`flex-1 text-left px-3 py-1.5 rounded text-sm transition flex items-center gap-1.5 ${selectedPage?.id === page.id
                                  ? 'bg-[var(--color-blue-primary)] text-white font-medium'
                                  : 'text-slate-500 hover:bg-slate-50'
                                }`}
                            >
                              <FileText className="w-3.5 h-3.5 flex-shrink-0" /> {page.title}
                            </button>
                            {/* Move up/down arrows */}
                            <span className="opacity-0 group-hover/page:opacity-100 flex flex-col ml-0.5 transition">
                              <span
                                role="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  movePageUp(page, idx);
                                }}
                                className={`p-0.5 rounded hover:bg-slate-100 ${idx === 0 ? 'pointer-events-none opacity-30' : ''} ${
                                  selectedPage?.id === page.id ? 'text-white/60 hover:text-[var(--color-blue-primary)] hover:bg-white/10' : 'text-slate-400 hover:text-[var(--color-blue-primary)]'
                                }`}
                                title="Move up"
                              >
                                <ChevronUp className="w-3 h-3" />
                              </span>
                              <span
                                role="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  movePageDown(page, idx, subjectPages.length);
                                }}
                                className={`p-0.5 rounded hover:bg-slate-100 ${idx === subjectPages.length - 1 ? 'pointer-events-none opacity-30' : ''} ${
                                  selectedPage?.id === page.id ? 'text-white/60 hover:text-[var(--color-blue-primary)] hover:bg-white/10' : 'text-slate-400 hover:text-[var(--color-blue-primary)]'
                                }`}
                                title="Move down"
                              >
                                <ChevronDown className="w-3 h-3" />
                              </span>
                            </span>
                            <span
                              role="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletePageTarget(page);
                              }}
                              className={`opacity-0 group-hover/page:opacity-100 transition ml-0.5 p-0.5 rounded hover:bg-red-50 ${
                                selectedPage?.id === page.id ? 'text-white/60 hover:text-red-400 hover:bg-white/10' : 'text-slate-400 hover:text-red-600'
                              }`}
                              title="Delete page"
                            >
                              <X className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        ))}

                        <button
                          onClick={createNewPage}
                          className="w-full text-left px-3 py-1.5 rounded text-sm text-slate-500 hover:bg-slate-50 hover:text-[var(--color-text-primary)] transition"
                        >
                          + New Page
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Note from AI Button */}
          <div className="p-4 border-t border-[var(--color-border-light)]">
            <button
              onClick={openAiPicker}
              className="w-full gradient-primary text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-smooth flex items-center justify-center gap-2 shadow-premium-md hover:shadow-premium-lg hover-scale"
            >
              <Bot className="w-4 h-4" /> Add Note from AI
            </button>
          </div>
        </aside>
        </ResizableSidebar>

        {/* Main Editor Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6">
            {selectedPage ? (
              <div className="card rounded-2xl p-8">
                {/* Editable Page Title */}
                <input type="text" value={selectedPage.title} onChange={(e) => updatePageTitle(e.target.value)} className="w-full heading-lg mb-2 border-none outline-none focus:ring-0 text-[var(--color-text-primary)]" placeholder="Untitled" />

                {/* Metadata */}
                <div className="flex gap-4 body-sm text-slate-500 mb-6 pb-6 border-b border-[var(--color-border-light)]">
                  <span className="flex items-center gap-1"><Folder className="w-3.5 h-3.5" /> {selectedPage.subject}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {new Date(selectedPage.updatedAt).toLocaleDateString()}</span>
                  {selectedPage.tags && selectedPage.tags.length > 0 && (
                    <span className="flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> {selectedPage.tags.join(', ')}</span>
                  )}
                </div>

                {/* Blocks */}
                <div className="space-y-3">
                  {selectedPage.blocks.map((block) => (
                    <div key={block.id} className="group relative">
                      {/* Delete button */}
                      <button
                        onClick={() => deleteBlock(block.id)}
                        className="absolute -left-8 top-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      {/* Block rendering */}
                      {block.type === 'heading' && (
                        <input type="text" value={block.text} onChange={(e) => updateBlockText(block.id, e.target.value)} className="w-full heading-md border-none outline-none focus:ring-0 text-[var(--color-text-primary)] py-2" placeholder="Heading" />
                      )}

                      {block.type === 'text' && (
                        <textarea value={block.text} onChange={(e) => updateBlockText(block.id, e.target.value)} className="w-full body-md border-none outline-none focus:ring-0 text-[var(--color-text-primary)] resize-none py-2" placeholder="Type something..." rows={2} />
                      )}

                      {block.type === 'checklist' && (
                        <div className="flex items-start gap-3 py-2">
                          <input type="checkbox" checked={block.checked || false} onChange={() => toggleChecklist(block.id)} className="mt-1 w-4 h-4 text-[var(--color-blue-primary)] rounded focus:ring-2 focus:ring-[var(--color-blue-primary)]" />
                            <input type="text" value={block.text} onChange={(e) => updateBlockText(block.id, e.target.value)} className={`flex-1 body-md border-none outline-none focus:ring-0 ${block.checked ? 'line-through text-slate-400' : 'text-[var(--color-text-primary)]'} `} placeholder="Checklist item" />
                        </div>
                      )}

                      {block.type === 'bullet' && (
                        <div className="flex items-start gap-3 py-2">
                          <span className="text-slate-500 mt-1">•</span>
                          <input type="text" value={block.text} onChange={(e) => updateBlockText(block.id, e.target.value)} className="flex-1 body-md border-none outline-none focus:ring-0 text-[var(--color-text-primary)]" placeholder="List item" />
                        </div>
                      )}

                      {block.type === 'divider' && (
                        <hr className="my-4 border-[var(--color-border-light)]" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Block Menu */}
                <div className="mt-6 relative">
                  <button
                    onClick={() => setShowBlockMenu(!showBlockMenu)}
                    className="text-slate-500 hover:text-[var(--color-text-primary)] text-sm font-medium flex items-center gap-2 py-2"
                  >
                    <span className="text-lg">+</span>
                    Add block
                  </button>

                  {showBlockMenu && (
                    <div className="absolute left-0 top-full mt-2 card rounded-lg py-2 z-10 w-56">
                      <button onClick={() => addBlock('heading')} className="w-full text-left px-4 py-2 hover:bg-slate-50 transition flex items-center gap-3">
                        <Heading className="w-5 h-5 text-slate-500" />
                        <span className="text-sm">Heading</span>
                      </button>
                      <button
                        onClick={() => addBlock('text')}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition flex items-center gap-3"
                      >
                        <Type className="w-5 h-5 text-slate-500" />
                        <span className="text-sm">Text</span>
                      </button>
                      <button
                        onClick={() => addBlock('checklist')}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition flex items-center gap-3"
                      >
                        <CheckSquare className="w-5 h-5 text-slate-500" />
                        <span className="text-sm">Checklist</span>
                      </button>
                      <button
                        onClick={() => addBlock('bullet')}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition flex items-center gap-3"
                      >
                        <List className="w-5 h-5 text-slate-500" />
                        <span className="text-sm">Bullet List</span>
                      </button>
                      <button
                        onClick={() => addBlock('divider')}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition flex items-center gap-3"
                      >
                        <Minus className="w-5 h-5 text-slate-500" />
                        <span className="text-sm">Divider</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="card p-12 text-center">
                <PenLine className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <h2 className="heading-md mb-2">No page selected</h2>
                <p className="body-md text-slate-500 mb-6">Select a page from the sidebar or create a new one</p>
                <button onClick={createNewPage} className="btn-primary">
                  Create New Page
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Tasks & Uploads */}
        <ResizableSidebar side="right" defaultWidth={320} minWidth={240} maxWidth={500} responsive>
        <aside className="w-full h-full card flex flex-col overflow-y-auto">
          {/* Tasks Section */}
          <div className="p-6 border-b border-[var(--color-border-light)]">
            <h2 className="heading-md mb-4 flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-[var(--color-blue-primary)]" />
              Tasks
            </h2>

            {/* Task List */}
            <div className="space-y-2 mb-4">
              {tasks.map(task => (
                <div key={task.id} className="flex items-start gap-2 group">
                  <input
                    type="checkbox"
                    checked={task.completed}
                    onChange={() => toggleTask(task.id)}
                    className="mt-1 w-4 h-4 text-[var(--color-blue-primary)] rounded focus:ring-2 focus:ring-[var(--color-blue-primary)]"
                  />
                  <span className={`flex-1 text-sm ${task.completed ? 'line-through text-slate-400' : 'text-[var(--color-text-primary)]'}`}>
                    {task.title}
                  </span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            {/* Add Task */}
            <div className="flex gap-2">
              <input type="text" value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addTask()} placeholder="New task..." className="input" />
              <button onClick={addTask} className="btn-primary px-4 py-2">+
              </button>
            </div>
          </div>

          {/* Documents Section */}
          <div className="p-6">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-[var(--color-blue-primary)]" />
              Documents
            </h2>

            {/* File Upload */}
            <div className="mb-4">
              <label className="card border-dashed p-4 text-center cursor-pointer hover:border-[var(--color-blue-primary)] hover:bg-[var(--color-blue-soft)]/10 transition">
                {isUploading ? (
                  <span className="text-sm text-slate-500 flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</span>
                ) : (
                  <span className="text-sm text-slate-500 flex items-center justify-center gap-2"><Upload className="w-4 h-4" /> Click to upload files</span>
                )}
                <input type="file" multiple onChange={handleFileUpload} className="hidden" accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.svg,.bmp,.csv,.xls,.xlsx,.txt,.rtf,.odt,.ods,.odp" disabled={isUploading} />
              </label>
            </div>

            {/* Documents List */}
            <div className="space-y-2">
              {uploadedFiles.map(file => (
                <div
                  key={file.id}
                  className="relative group"
                >
                  <button onClick={() => openDocumentPreview(file)} className="card p-3 hover:border-[var(--color-blue-primary)] transition cursor-pointer text-left">
                    <span className="flex-shrink-0">
                      {getFileIcon(file.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 uppercase font-semibold">
                          {file.type}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          {file.uploadedAt}
                        </span>
                      </div>
                    </div>
                    <span className="text-[var(--color-blue-primary)] opacity-0 group-hover:opacity-100 transition">
                      <Eye className="w-4 h-4" />
                    </span>
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
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition bg-white rounded p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {uploadedFiles.length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  <Inbox className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">No documents yet</p>
                </div>
              )}
            </div>
          </div>
        </aside>
        </ResizableSidebar>
      </div>

      {/* Document Preview Modal */}
      {previewDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--color-surface-muted)] rounded-lg w-full max-w-5xl h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-light)]">
              <div className="flex items-center gap-3">
                <span>{getFileIcon(previewDocument.type)}</span>
                <div>
                  <h3 className="font-bold text-gray-900">{previewDocument.name}</h3>
                  <p className="text-sm text-gray-500">
                    {previewDocument.type.toUpperCase()} • {previewDocument.uploadedAt}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {previewDocument.url && (
                  <a href={previewDocument.url} download={previewDocument.name} className="btn-primary">
                    Download →
                  </a>
                )}
                <button onClick={closeDocumentPreview} className="btn-secondary">
                  Close
                </button>
              </div>
            </div>

            {/* Modal Body - Document Preview */}
            <div className="flex-1 overflow-hidden">
              {previewDocument.url && previewDocument.type === 'pdf' ? (
                <embed
                  src={previewDocument.url}
                  type="application/pdf"
                  className="w-full h-full"
                  title={previewDocument.name}
                />
              ) : previewDocument.url && previewDocument.type === 'image' ? (
                <div className="flex items-center justify-center h-full p-4 overflow-auto bg-gray-50">
                  <img src={previewDocument.url} alt={previewDocument.name} className="max-w-full max-h-full object-contain rounded shadow-premium-md" />
                </div>
              ) : previewDocument.url && previewDocument.type === 'csv' ? (
                <CsvPreview url={previewDocument.url} />
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <div className="text-center">
                    <div className="mb-4 flex justify-center [&_svg]:w-16 [&_svg]:h-16">{getFileIcon(previewDocument.type)}</div>
                    <p className="text-lg font-semibold mb-2">{previewDocument.name}</p>
                    <p className="text-sm text-slate-400 mb-6">This file type cannot be previewed inline</p>
                    {previewDocument.url && (
                      <a href={previewDocument.url} download={previewDocument.name} className="btn-primary">Download File</a>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card rounded-2xl w-full max-w-lg mx-4 max-h-[70vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border-light)]">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Bot className="w-5 h-5" /> Add Note from AI
              </h3>
              <button onClick={() => setShowAiPicker(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoadingAi ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-8 h-8 animate-spin mb-3" />
                  <p className="text-sm">Loading AI conversations...</p>
                </div>
              ) : aiMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Bot className="w-10 h-10 mb-3" />
                  <p className="text-sm font-medium">No AI responses found</p>
                  <p className="text-xs mt-1">Chat with the AI Assistant first to generate notes</p>
                </div>
              ) : (
                aiMessages.map((msg) => (
                  <button key={msg.id} onClick={() => addNoteFromAI(msg)} className="card p-4 rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                          {msg.question || 'AI Response'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-3">
                          {msg.text.replace(/[#*_~`>]/g, '').substring(0, 200)}
                          {msg.text.length > 200 ? '...' : ''}
                        </p>
                        <p className="text-xs text-slate-400 mt-2">
                          {new Date(msg.createdAt).toLocaleDateString()} {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <Plus className="w-5 h-5 text-slate-300 group-hover:text-[var(--color-blue-primary)] transition flex-shrink-0 mt-1" />
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
