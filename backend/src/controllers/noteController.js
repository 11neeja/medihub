import prisma from '../config/prisma.js'

// Default subjects for new users
const DEFAULT_SUBJECTS = ['Anatomy', 'Pathology', 'Pharmacology', 'Surgery']

// @desc    Get all subjects for logged-in user
// @route   GET /api/notes/subjects
export const getSubjects = async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { userId: req.user.id },
      select: { subject: true },
      distinct: ['subject'],
    })
    const noteSubjects = notes.map(n => n.subject)
    const allSubjects = [...new Set([...DEFAULT_SUBJECTS, ...noteSubjects])]
    res.json(allSubjects)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Create a new subject (creates a placeholder note so the subject persists)
// @route   POST /api/notes/subjects
export const createSubject = async (req, res) => {
  try {
    const { name } = req.body
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Subject name is required' })
    }

    const trimmedName = name.trim()

    const existing = await prisma.note.findFirst({
      where: { userId: req.user.id, subject: trimmedName },
    })
    if (existing) {
      return res.status(400).json({ message: 'Subject already exists' })
    }

    await prisma.note.create({
      data: {
        userId: req.user.id,
        title: '__subject_placeholder__',
        subject: trimmedName,
        tags: ['__system__'],
      },
    })

    res.status(201).json({ name: trimmedName })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Rename a subject (updates all notes under it)
// @route   PUT /api/notes/subjects/:name
export const renameSubject = async (req, res) => {
  try {
    const oldName = decodeURIComponent(req.params.name)
    const { newName } = req.body
    if (!newName || !newName.trim()) {
      return res.status(400).json({ message: 'New name is required' })
    }
    const trimmed = newName.trim()

    const existing = await prisma.note.findFirst({
      where: { userId: req.user.id, subject: trimmed },
    })
    if (existing) {
      return res.status(400).json({ message: 'A subject with that name already exists' })
    }

    await prisma.note.updateMany({
      where: { userId: req.user.id, subject: oldName },
      data: { subject: trimmed },
    })
    res.json({ oldName, newName: trimmed })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Delete a subject and all its notes
// @route   DELETE /api/notes/subjects/:name
export const deleteSubject = async (req, res) => {
  try {
    const subjectName = decodeURIComponent(req.params.name)
    // First delete all blocks for notes in this subject
    const notes = await prisma.note.findMany({
      where: { userId: req.user.id, subject: subjectName },
      select: { id: true },
    })
    const noteIds = notes.map(n => n.id)
    if (noteIds.length > 0) {
      await prisma.noteBlock.deleteMany({ where: { noteId: { in: noteIds } } })
    }
    await prisma.note.deleteMany({ where: { userId: req.user.id, subject: subjectName } })
    res.json({ message: 'Subject and its notes deleted' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Get all notes for logged-in user
// @route   GET /api/notes
export const getNotes = async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: {
        userId: req.user.id,
        title: { not: '__subject_placeholder__' },
      },
      include: { blocks: { orderBy: { order: 'asc' } } },
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
    })
    res.json(notes.map(n => ({
      ...n,
      _id: n.id,
      blocks: (n.blocks || []).map(b => ({ ...b, _id: b.id })),
    })))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Create a note
// @route   POST /api/notes
export const createNote = async (req, res) => {
  try {
    const { title, subject, blocks, tags } = req.body
    const note = await prisma.note.create({
      data: {
        userId: req.user.id,
        title,
        subject,
        tags: tags || [],
        blocks: {
          create: (blocks || []).map((b, i) => ({
            type: b.type,
            text: b.text || '',
            checked: b.checked || false,
            order: i,
          })),
        },
      },
      include: { blocks: { orderBy: { order: 'asc' } } },
    })
    res.status(201).json({
      ...note,
      _id: note.id,
      blocks: (note.blocks || []).map(b => ({ ...b, _id: b.id })),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Update a note
// @route   PUT /api/notes/:id
export const updateNote = async (req, res) => {
  try {
    const existing = await prisma.note.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!existing) return res.status(404).json({ message: 'Note not found' })

    const { title, subject, blocks, tags } = req.body
    const updateData = {}
    if (title !== undefined) updateData.title = title
    if (subject !== undefined) updateData.subject = subject
    if (tags !== undefined) updateData.tags = tags

    // If blocks are provided, replace them
    if (blocks !== undefined) {
      await prisma.noteBlock.deleteMany({ where: { noteId: req.params.id } })
      updateData.blocks = {
        create: blocks.map((b, i) => ({
          type: b.type,
          text: b.text || '',
          checked: b.checked || false,
          order: i,
        })),
      }
    }

    const note = await prisma.note.update({
      where: { id: req.params.id },
      data: updateData,
      include: { blocks: { orderBy: { order: 'asc' } } },
    })
    res.json({
      ...note,
      _id: note.id,
      blocks: (note.blocks || []).map(b => ({ ...b, _id: b.id })),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Reorder notes within a subject
// @route   PUT /api/notes/reorder
export const reorderNotes = async (req, res) => {
  try {
    const { noteIds } = req.body
    if (!noteIds || !Array.isArray(noteIds)) {
      return res.status(400).json({ message: 'noteIds array is required' })
    }

    // Update each note's position in a transaction
    await prisma.$transaction(
      noteIds.map((id, index) =>
        prisma.note.updateMany({
          where: { id, userId: req.user.id },
          data: { position: index },
        })
      )
    )

    res.json({ message: 'Notes reordered' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Delete a note
// @route   DELETE /api/notes/:id
export const deleteNote = async (req, res) => {
  try {
    const note = await prisma.note.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!note) return res.status(404).json({ message: 'Note not found' })
    // Blocks cascade-delete via onDelete: Cascade
    await prisma.note.delete({ where: { id: req.params.id } })
    res.json({ message: 'Note deleted' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
