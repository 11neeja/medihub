'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Bot, BookOpen, FileText, BarChart3, Lightbulb, MessageCircle, Save, Target, Send, Trash2, X, Upload, Loader2, Image, Table, File, Presentation, CheckCircle2, AlertCircle } from 'lucide-react';
import ConfirmModal from '@/components/ConfirmModal';
import ResizableSidebar from '@/components/ResizableSidebar';
import {
  getDocumentsAPI,
  uploadDocumentAPI,
  deleteDocumentAPI,
  aiChatAPI,
  aiSummarizeAPI,
  getAiMessagesAPI,
  saveAiMessageAPI,
  clearAiMessagesAPI,
} from '@/lib/api';

// Type definitions
type Sender = 'user' | 'assistant';

interface AssistantMessage {
  id: string;
  sender: Sender;
  text: string;
  createdAt: string;
  relatedDocumentId?: string;
}

interface UploadedDocument {
  id: string;
  name: string;
  type: string;
  uploadedAt: string;
  summary?: string;
  size?: string;
}

// File type detection
const getFileType = (fileName: string, mimeType: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['pdf'].includes(ext)) return 'pdf';
  if (['ppt', 'pptx'].includes(ext)) return 'ppt';
  if (['doc', 'docx'].includes(ext)) return 'doc';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext)) return 'image';
  if (['csv'].includes(ext)) return 'csv';
  if (['xls', 'xlsx'].includes(ext)) return 'excel';
  return 'other';
};

// File icon component
const FileIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'pdf': return <FileText className="w-5 h-5 text-red-600" />;
    case 'ppt': return <Presentation className="w-5 h-5 text-orange-500" />;
    case 'image': return <Image className="w-5 h-5 text-blue-500" />;
    case 'csv':
    case 'excel': return <Table className="w-5 h-5 text-green-600" />;
    case 'doc': return <FileText className="w-5 h-5 text-blue-600" />;
    default: return <File className="w-5 h-5 text-slate-500" />;
  }
};

// Accepted file types
const ACCEPTED_FILE_TYPES = '.pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp,.csv,.xls,.xlsx';

export default function AssistantPage() {
  const { addNote } = useApp();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const WELCOME_MESSAGE: AssistantMessage = {
    id: 'm1',
    sender: 'assistant',
    text: '👋 Hello! I\'m your **MediHub AI Assistant**.\n\nI can help you with:\n• Answering medical questions\n• Summarizing uploaded documents (PDF, PPT, Images, CSV & more)\n• Explaining complex concepts\n• Providing study tips\n\nUpload a document to get started, or ask me anything!',
    createdAt: new Date().toISOString(),
  };

  const [messages, setMessages] = useState<AssistantMessage[]>([WELCOME_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [selectedDocument, setSelectedDocument] = useState<UploadedDocument | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null);
  const [showClearChat, setShowClearChat] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load chat history from database on mount
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const saved = await getAiMessagesAPI();
        if (saved && saved.length > 0) {
          const mapped: AssistantMessage[] = saved.map((m: any) => ({
            id: m.id,
            sender: m.sender,
            text: m.text,
            createdAt: m.createdAt,
            relatedDocumentId: m.relatedDocumentId || undefined,
          }));
          setMessages([WELCOME_MESSAGE, ...mapped]);
        }
      } catch (err) {
        console.error('Failed to load chat history:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    };
    fetchMessages();
  }, []);

  // Load documents from database on mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const docs = await getDocumentsAPI('assistant');
        const mapped: UploadedDocument[] = docs.map((d: any) => ({
          id: d._id,
          name: d.name,
          type: d.type,
          uploadedAt: d.createdAt,
          size: d.size ? `${(d.size / 1024).toFixed(1)} KB` : undefined,
        }));
        setDocuments(mapped);
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocuments();
  }, []);

  // Handle file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];

    if (file.size > 250 * 1024 * 1024) {
      showToast('File is too large. Maximum size is 250MB.', 'error');
      return;
    }

    setIsProcessing(true);

    try {
      const fileType = getFileType(file.name, file.type);

      const savedDoc = await uploadDocumentAPI({
        name: file.name,
        type: fileType,
        file: file,
        source: 'assistant',
      });

      const newDoc: UploadedDocument = {
        id: savedDoc._id,
        name: savedDoc.name,
        type: savedDoc.type,
        uploadedAt: savedDoc.createdAt,
        size: `${(file.size / 1024).toFixed(1)} KB`,
      };

      setDocuments(prev => [...prev, newDoc]);
      setSelectedDocument(newDoc);

      const uploadMsg: AssistantMessage = {
        id: `m${Date.now()}`,
        sender: 'assistant',
        text: `⏳ **"${file.name}" uploaded successfully!** Generating summary...`,
        createdAt: new Date().toISOString(),
        relatedDocumentId: newDoc.id,
      };
      setMessages(prev => [...prev, uploadMsg]);

      try {
        const summaryData = await aiSummarizeAPI(savedDoc._id);
        const summaryMsg: AssistantMessage = {
          id: `m${Date.now() + 1}`,
          sender: 'assistant',
          text: `📄 **Summary of "${file.name}"**\n\n${summaryData.summary}`,
          createdAt: new Date().toISOString(),
          relatedDocumentId: newDoc.id,
        };
        setMessages(prev => [
          ...prev.filter(m => m.id !== uploadMsg.id),
          summaryMsg,
        ]);
        newDoc.summary = summaryData.summary;

        // Persist summary message
        saveAiMessageAPI({
          sender: 'assistant',
          text: summaryMsg.text,
          relatedDocumentId: newDoc.id,
        }).catch(console.error);
      } catch (summaryErr) {
        console.error('Summary failed:', summaryErr);
        const errorMsg: AssistantMessage = {
          id: `m${Date.now() + 1}`,
          sender: 'assistant',
          text: `✅ **"${file.name}" uploaded and saved!**\n\nThe document has been stored in your library. You can now ask me questions about it!\n\n💡 Try selecting the document and asking specific questions about its content.`,
          createdAt: new Date().toISOString(),
          relatedDocumentId: newDoc.id,
        };
        setMessages(prev => [
          ...prev.filter(m => m.id !== uploadMsg.id),
          errorMsg,
        ]);

        // Persist fallback message
        saveAiMessageAPI({
          sender: 'assistant',
          text: errorMsg.text,
          relatedDocumentId: newDoc.id,
        }).catch(console.error);
      }

    } catch (err: any) {
      console.error('Upload failed:', err);
      const errorMsg: AssistantMessage = {
        id: `m${Date.now()}`,
        sender: 'assistant',
        text: `❌ **Upload failed**: ${err?.response?.data?.message || err.message || 'Unknown error'}. Please try again.`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!inputText.trim() || isProcessing) return;

    const userText = inputText;
    const userMessage: AssistantMessage = {
      id: `m${Date.now()}`,
      sender: 'user',
      text: userText,
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsProcessing(true);

    // Save user message to DB
    saveAiMessageAPI({ sender: 'user', text: userText }).then(saved => {
      if (saved?.id) {
        setMessages(prev => prev.map(m => m.id === userMessage.id ? { ...m, id: saved.id } : m));
      }
    }).catch(console.error);

    try {
      const chatHistory = messages
        .filter(m => m.id !== 'm1')
        .slice(-10)
        .map(m => ({ sender: m.sender, text: m.text }));

      const documentIds = selectedDocument
        ? [selectedDocument.id]
        : documents.map(d => d.id);

      const data = await aiChatAPI({
        message: userText,
        documentIds: documentIds.length > 0 ? documentIds : undefined,
        chatHistory,
      });

      const aiResponse: AssistantMessage = {
        id: `m${Date.now() + 1}`,
        sender: 'assistant',
        text: data.response,
        createdAt: new Date().toISOString(),
        relatedDocumentId: selectedDocument?.id,
      };

      setMessages(prev => [...prev, aiResponse]);

      // Save AI response to DB
      saveAiMessageAPI({
        sender: 'assistant',
        text: data.response,
        relatedDocumentId: selectedDocument?.id,
      }).then(saved => {
        if (saved?.id) {
          setMessages(prev => prev.map(m => m.id === aiResponse.id ? { ...m, id: saved.id } : m));
        }
      }).catch(console.error);
    } catch (err: any) {
      console.error('Chat error:', err);
      const status = err?.response?.status;
      let errorText = '❌ Sorry, I encountered an error processing your question. Please try again.';
      if (status === 429) {
        errorText = '⚠️ **AI is temporarily unavailable** due to rate limits. Please wait about a minute and try again.';
      } else if (err?.response?.data?.message) {
        errorText = `❌ ${err.response.data.message}`;
      }
      const errorMsg: AssistantMessage = {
        id: `m${Date.now() + 1}`,
        sender: 'assistant',
        text: errorText,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsProcessing(false);
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

    for (const rawLine of lines) {
      const line = rawLine.trim();

      // Skip empty lines (flush accumulated text)
      if (!line) {
        flushText();
        continue;
      }

      // Markdown headings: # Heading, ## Heading, ### Heading
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

      // Regular text line - accumulate
      currentTextLines.push(line.replace(/\*\*/g, ''));
    }

    // Flush any remaining text
    flushText();

    // Fallback: if no blocks were created, add the whole text
    if (blocks.length === 0) {
      blocks.push({ type: 'text', text: text.replace(/\*\*/g, '') });
    }

    return blocks;
  };

  // Find the user question that preceded this assistant message
  const findUserQuestion = (message: AssistantMessage): string => {
    const msgIndex = messages.findIndex(m => m.id === message.id);
    if (msgIndex > 0) {
      for (let i = msgIndex - 1; i >= 0; i--) {
        if (messages[i].sender === 'user') {
          const q = messages[i].text;
          return q.length > 80 ? q.substring(0, 77) + '...' : q;
        }
      }
    }
    return `AI Response - ${new Date().toLocaleDateString()}`;
  };

  // Save to notebook via API
  const handleSaveToNotebook = async (message: AssistantMessage) => {
    try {
      const blocks = parseMarkdownToBlocks(message.text);
      const title = findUserQuestion(message);

      await addNote({
        subject: 'AI Assistant',
        title,
        blocks,
        tags: ['AI Assistant'],
      });
      showToast('Saved to your Notebook!', 'success');
    } catch (err) {
      console.error('Save failed:', err);
      showToast('Failed to save to notebook.', 'error');
    }
  };

  // Delete document from database
  const handleDeleteDocument = async (docId: string) => {
    try {
      await deleteDocumentAPI(docId);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      if (selectedDocument?.id === docId) {
        setSelectedDocument(null);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      showToast('Failed to delete document.', 'error');
    } finally {
      setDeleteDocId(null);
    }
  };

  // Clear entire chat history
  const handleClearChat = async () => {
    try {
      await clearAiMessagesAPI();
      setMessages([WELCOME_MESSAGE]);
    } catch (err) {
      console.error('Failed to clear chat:', err);
      showToast('Failed to clear chat history.', 'error');
    } finally {
      setShowClearChat(false);
    }
  };

  // Format time
  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="min-h-screen gradient-subtle">
      {/* Custom Toast Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-fade-in-down">
          <div className={`flex items-center gap-2.5 px-5 py-3 rounded-xl shadow-premium-lg border ${
            toast.type === 'success'
              ? 'bg-[var(--color-blue-primary)] text-[var(--color-blue-soft)] border-[var(--color-border-mid)]'
              : 'bg-red-600 text-white border-red-500'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{toast.message}</span>
            <button onClick={() => setToast(null)} className="ml-2 opacity-70 hover:opacity-100 transition-opacity">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
      <div className="page-container">
        {/* Page Header */}
        <div className="card rounded-3xl p-6 md:p-8 mb-6 animate-section">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
            <div>
              <p className="label mb-2">AI Assistant</p>
              <h1 className="heading-2 mb-2 fade-in-up">AI Study Assistant</h1>
              <p className="body-md fade-in-delay-1">Upload documents, ask questions, and get instant medical knowledge</p>
            </div>
            {messages.length > 1 && (
              <button onClick={() => setShowClearChat(true)} className="btn-secondary inline-flex items-center gap-2 !py-2.5 text-red-600 hover:bg-red-50 self-start">
                <Trash2 className="w-4 h-4" /> Clear Chat
              </button>
            )}
          </div>
        </div>

        {/* Main Layout */}
        <div className="card rounded-3xl overflow-hidden flex flex-col lg:flex-row h-[calc(100vh-280px)] min-h-[560px]">
        {/* Left Sidebar - Documents */}
        <ResizableSidebar side="left" defaultWidth={320} minWidth={240} maxWidth={480} responsive>
        <aside className="w-full h-full bg-[var(--color-surface-muted)] lg:border-r border-[var(--color-border-light)] flex flex-col">
          <div className="p-4 border-b border-[var(--color-border-light)]">
            <h2 className="heading-md mb-3 flex items-center gap-2"><BookOpen className="w-4 h-4 text-[var(--color-blue-primary)]" /> Your Documents</h2>

            {/* Upload Button */}
            <label className="btn-primary block w-full text-center py-3 px-4 rounded-xl font-semibold cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                onChange={handleFileUpload}
                className="hidden"
                disabled={isProcessing}
              />
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Upload className="w-4 h-4" /> Upload Document
                </span>
              )}
            </label>
            <p className="text-xs text-slate-400 mt-1.5 text-center">PDF, PPT, Images, CSV, Excel & more</p>
          </div>

          {/* Documents List */}
            <div className="flex-1 overflow-y-auto p-4">
                {isLoadingDocs ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[var(--color-blue-primary)]" />
              </div>
            ) : documents.length === 0 ? (
              <div className="text-center py-12">
                <div className="mb-4 flex justify-center"><FileText className="w-14 h-14 text-slate-300" /></div>
                <p className="text-slate-500 text-sm">
                  No documents yet.<br />Upload a file to get started!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map(doc => (
                  <div key={doc.id} className={`card p-3 transition-smooth cursor-pointer ${selectedDocument?.id === doc.id ? 'shadow-premium' : ''}`} onClick={() => setSelectedDocument(selectedDocument?.id === doc.id ? null : doc)}>
                    <div className="flex items-start gap-2 mb-2">
                      <FileIcon type={doc.type} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-[var(--color-text-primary)] truncate">
                          {doc.name}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {doc.size && `${doc.size} • `}{doc.type?.toUpperCase()} • {formatTime(doc.uploadedAt)}
                        </p>
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteDocId(doc.id); }} className="text-xs text-red-600 hover:text-red-700 font-semibold flex items-center gap-1"> <Trash2 className="w-3 h-3" /> Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Document Info */}
          {selectedDocument && (
                <div className="p-4 border-t border-[var(--color-border-light)] bg-[var(--color-surface-muted)]">
              <h3 className="font-semibold text-sm text-[var(--color-text-primary)] mb-2 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-[var(--color-blue-primary)]" /> Chatting about:
              </h3>
              <p className="text-xs text-slate-600 mb-2 font-medium truncate">{selectedDocument.name}</p>
              <p className="text-xs text-slate-400">AI responses will be based on this document</p>
              <button
                onClick={() => setSelectedDocument(null)}
                className="text-xs text-[var(--color-blue-primary)] hover:text-[var(--color-blue-primary)] font-semibold mt-2 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Deselect
              </button>
            </div>
          )}
        </aside>
        </ResizableSidebar>

        {/* Center - Chat Interface */}
        <main className="flex-1 flex flex-col bg-[var(--color-surface-muted)] min-w-0 transition-all duration-300">
          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="mb-4 flex justify-center"><Bot className="w-20 h-20 text-[var(--color-blue-soft)]" /></div>
                  <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">
                    Ready to assist!
                  </h2>
                  <p className="text-slate-500">Ask a question or upload a document</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-2xl ${message.sender === 'user' ? 'ml-12' : 'mr-12'}`}>
                      {/* Sender Label */}
                      <div className={`flex items-center gap-2 mb-2 ${message.sender === 'user' ? 'justify-end' : 'justify-start'
                        }`}>
                          {message.sender === 'assistant' && (
                          <>
                            <div className="w-6 h-6 bg-[var(--color-blue-primary)] rounded-full flex items-center justify-center">
                              <Bot className="w-3.5 h-3.5 text-white" />
                            </div>
                            <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                              MediHub AI
                            </span>
                          </>
                        )}
                        {message.sender === 'user' && (
                          <>
                            <span className="text-xs font-semibold text-slate-500">You</span>
                            <UserAvatar userId={user?._id || 'current-user'} name={user?.name || 'You'} size={24} />
                          </>
                        )}
                      </div>

                      {/* Message Bubble */}
                      <div className={"p-4 shadow-premium " + (message.sender === 'user' ? 'user-prompt-bubble' : 'ai-response-card')}>
                        <div className="prose prose-sm max-w-none">
                          {message.text.split('\n').map((line, i) => {
                            // Handle bold markdown
                            const parts = line.split(/(\*\*.*?\*\*)/g);
                            return (
                              <p key={i} className="mb-2 last:mb-0">
                                {parts.map((part, j) => {
                                  if (part.startsWith('**') && part.endsWith('**')) {
                                    return (
                                      <strong key={j}>
                                        {part.slice(2, -2)}
                                      </strong>
                                    );
                                  }
                                  return <span key={j}>{part}</span>;
                                })}
                              </p>
                            );
                          })}
                        </div>

                        {/* Timestamp */}
                        <div className={`text-xs mt-2 ${message.sender === 'user' ? 'text-[var(--color-text-muted)]' : 'text-slate-500'
                          }`}>
                          {formatTime(message.createdAt)}
                        </div>
                      </div>

                      {/* Actions for assistant messages */}
                      {message.sender === 'assistant' && message.id !== 'm1' && (
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => handleSaveToNotebook(message)} className="btn-primary text-xs px-3 py-1 rounded-xl font-semibold flex items-center gap-1">
                            <Save className="w-3 h-3" /> Save to Notebook
                          </button>
                          {message.relatedDocumentId && (
                            <span className="text-xs bg-[var(--color-blue-soft)] text-[var(--color-blue-primary)] px-3 py-1 rounded-lg font-semibold flex items-center gap-1">
                              <FileText className="w-3 h-3" /> From Document
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Processing Indicator */}
                {isProcessing && (
                  <div className="flex justify-start">
                    <div className="mr-12">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-[var(--color-blue-primary)] rounded-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-[var(--color-blue-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-[var(--color-blue-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-[var(--color-blue-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          <Bot className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-xs font-semibold text-slate-500">
                          AI Assistant
                        </span>
                      </div>
                      <div className="bg-slate-100 rounded-lg p-4">
                        <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                            <div className="w-2 h-2 bg-[var(--color-blue-primary)] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-2 h-2 bg-[var(--color-blue-primary)] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-2 h-2 bg-[var(--color-blue-primary)] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          </div>
                          <span className="text-sm text-slate-500">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-[var(--color-border-light)] bg-[var(--color-surface-white)] p-6">
            <div>
              {/* Input Field */}
              <div className="flex gap-3">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder={
                    selectedDocument
                      ? `Ask about "${selectedDocument.name}"...`
                      : 'Ask a medical question...'
                  }
                  className="input flex-1 resize-none"
                  rows={2}
                  disabled={isProcessing}
                />
                <button onClick={handleSendMessage} disabled={!inputText.trim() || isProcessing} className="btn-primary px-8 rounded-xl font-semibold disabled:opacity-50 flex items-center gap-2">
                  {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Press Enter to send, Shift+Enter for new line
              </p>
            </div>
          </div>
        </main>

        {/* Right Sidebar - Info & Tips */}
        <ResizableSidebar side="right" defaultWidth={320} minWidth={240} maxWidth={480} responsive>
        <aside className="w-full h-full bg-[var(--color-surface-white)] border-l border-[var(--color-border-light)] overflow-y-auto">
          <div className="p-6">
            {/* Usage Stats */}
            <div className="mb-6">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[var(--color-blue-primary)]" /> Your Activity</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-[var(--color-surface-muted)] rounded-lg">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> Documents</span>
                  <span className="font-bold text-[var(--color-blue-primary)]">{documents.length}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--color-blue-soft)] rounded-lg">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Questions Asked</span>
                  <span className="font-bold text-[var(--color-blue-primary)]">
                    {messages.filter(m => m.sender === 'user').length}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--color-surface-muted)] rounded-lg">
                  <span className="text-sm text-slate-500 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5" /> Responses</span>
                  <span className="font-bold text-[var(--color-blue-primary)]">
                    {messages.filter(m => m.sender === 'assistant').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Tips */}
            <div className="mb-6">
              <h3 className="font-bold text-[var(--color-text-primary)] mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-[var(--color-blue-primary)]" /> Quick Tips</h3>
              <div className="space-y-3 text-sm text-slate-500">
                <div className="p-3 bg-[var(--color-surface-muted)] rounded-lg border border-[var(--color-border-light)]">
                  <p className="font-semibold text-[var(--color-blue-primary)] mb-1 flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" /> Upload Documents</p>
                  <p className="text-xs">Upload PDFs, PPTs, images, CSVs, or Excel files for instant AI analysis</p>
                </div>
                <div className="p-3 bg-[var(--color-blue-soft)] rounded-lg border border-[var(--color-border-light)]">
                  <p className="font-semibold text-[var(--color-blue-primary)] mb-1 flex items-center gap-1.5"><MessageCircle className="w-3.5 h-3.5" /> Ask Questions</p>
                  <p className="text-xs">Get explanations on medical concepts, diseases, treatments, and more</p>
                </div>
                <div className="p-3 bg-[var(--color-surface-muted)] rounded-lg border border-[var(--color-border-light)]">
                  <p className="font-semibold text-[var(--color-blue-primary)] mb-1 flex items-center gap-1.5"><Save className="w-3.5 h-3.5" /> Save Responses</p>
                  <p className="text-xs">Save helpful AI responses directly to your Notebook for later review</p>
                </div>
              </div>
            </div>

          </div>
        </aside>
        </ResizableSidebar>
      </div>

      {/* Delete Document Confirmation */}
      <ConfirmModal
        open={!!deleteDocId}
        title="Delete Document?"
        message="This document will be permanently removed. Related summaries will remain in chat."
        confirmLabel="Delete"
        onConfirm={() => deleteDocId && handleDeleteDocument(deleteDocId)}
        onCancel={() => setDeleteDocId(null)}
      />

      {/* Clear Chat Confirmation */}
      <ConfirmModal
        open={showClearChat}
        title="Clear Chat History?"
        message="This will permanently delete all chat messages. This action cannot be undone."
        confirmLabel="Clear All"
        variant="warning"
        onConfirm={handleClearChat}
        onCancel={() => setShowClearChat(false)}
      />
    </div>
    </div>
  );
}
