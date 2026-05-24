import prisma from '../config/prisma.js'

// @desc    Get all tasks for logged-in user
// @route   GET /api/tasks
export const getTasks = async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    })
    res.json(tasks.map(t => ({ ...t, _id: t.id })))
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Create a task
// @route   POST /api/tasks
export const createTask = async (req, res) => {
  try {
    const { title } = req.body
    const task = await prisma.task.create({
      data: { userId: req.user.id, title },
    })
    res.status(201).json({ ...task, _id: task.id })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Toggle task completion
// @route   PUT /api/tasks/:id/toggle
export const toggleTask = async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!task) return res.status(404).json({ message: 'Task not found' })

    const updated = await prisma.task.update({
      where: { id: req.params.id },
      data: { completed: !task.completed },
    })
    res.json({ ...updated, _id: updated.id })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Delete a task
// @route   DELETE /api/tasks/:id
export const deleteTask = async (req, res) => {
  try {
    const task = await prisma.task.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    })
    if (!task) return res.status(404).json({ message: 'Task not found' })
    await prisma.task.delete({ where: { id: req.params.id } })
    res.json({ message: 'Task deleted' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
