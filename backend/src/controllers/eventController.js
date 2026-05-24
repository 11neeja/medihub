import prisma from '../config/prisma.js'

// ─── Eventbrite cache (24-hour TTL) ────────────────────────────────
const EVENTBRITE_TOKEN = process.env.EVENTBRITE_TOKEN || 'VKHZN7QHV2CGY46EFPKY'
const EVENTBRITE_BASE  = 'https://www.eventbriteapi.com/v3'
const CACHE_TTL_MS     = 24 * 60 * 60 * 1000 // 24 hours

let eventbriteCache = {
  events: [],
  fetchedAt: 0,
}

// Helper: map Eventbrite format tag → our type
const mapFormatTag = (tags) => {
  const formatTag = tags?.find(t => t.prefix === 'EventbriteFormat')
  const name = formatTag?.display_name?.toLowerCase() || ''
  if (name.includes('seminar') || name.includes('talk') || name.includes('class')) return 'Workshop'
  if (name.includes('conference')) return 'Conference'
  if (name.includes('festival') || name.includes('expo') || name.includes('show')) return 'Fest'
  if (name.includes('networking') || name.includes('party')) return 'Fest'
  if (name.includes('workshop') || name.includes('training')) return 'Workshop'
  return 'Conference'
}

// Helper: fetch real image URL from Eventbrite media API
const fetchImageUrl = async (imageId) => {
  if (!imageId) return ''
  try {
    const res = await fetch(`${EVENTBRITE_BASE}/media/${imageId}/?token=${EVENTBRITE_TOKEN}`)
    if (res.ok) {
      const data = await res.json()
      return data.original?.url || data.crop_mask?.original?.url || data.url || ''
    }
  } catch (err) {
    console.error(`[Eventbrite] Failed to fetch image ${imageId}:`, err.message)
  }
  return ''
}

// Helper: resolve image URL from multiple possible fields on the event object
const resolveImageUrl = async (event) => {
  // 1) Try the image_id via media API
  const fromMedia = await fetchImageUrl(event.image_id)
  if (fromMedia) return fromMedia

  // 2) Direct image object (some API responses include this)
  if (event.image?.url) return event.image.url
  if (event.image?.original?.url) return event.image.original.url

  // 3) Logo object
  if (event.logo?.url) return event.logo.url
  if (event.logo?.original?.url) return event.logo.original.url

  // 4) Primary image
  if (event.primary_image?.url) return event.primary_image.url

  return ''
}

// Helper: extract city location from locations array
const getLocation = (locations, isOnline) => {
  if (isOnline) return 'Online'
  if (!locations || !locations.length) return 'TBA'
  const locality = locations.find(l => l.type === 'locality')
  const region = locations.find(l => l.type === 'region')
  const country = locations.find(l => l.type === 'country')
  const parts = [locality?.name, region?.name, country?.name].filter(Boolean)
  return parts.join(', ') || 'TBA'
}

// Helper: format time from HH:MM to 12hr format
const formatTime12 = (time24) => {
  if (!time24) return ''
  const [h, m] = time24.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 || 12
  return `${hr.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`
}

// Helper: map a single destination_event → our Event shape (imageUrl resolved separately)
const mapDestinationEvent = (eb, imageUrl) => {
  const startTime = formatTime12(eb.start_time)
  const endTime   = formatTime12(eb.end_time)
  const timeStr   = startTime && endTime ? `${startTime} - ${endTime}` : startTime || 'TBA'

  return {
    _id:              `eb-${eb.id}`,
    id:               `eb-${eb.id}`,
    title:            eb.name || 'Untitled Event',
    organizer:        'Eventbrite',
    date:             eb.start_date || '',
    time:             timeStr,
    location:         getLocation(eb.locations, eb.is_online_event),
    mode:             eb.is_online_event ? 'Online' : 'On-campus',
    type:             mapFormatTag(eb.tags),
    shortDescription: eb.summary || '',
    longDescription:  eb.summary || '',
    imageUrl:         imageUrl || '',
    featured:         false,
    capacity:         null,
    registered:       0,
    isRegistered:     false,
    source:           'eventbrite',
    eventbriteUrl:    eb.url || '',
  }
}

// Fetch events from Eventbrite destination/search API (with 24hr cache)
const fetchEventbriteEvents = async () => {
  const now = Date.now()
  if (eventbriteCache.events.length > 0 && now - eventbriteCache.fetchedAt < CACHE_TTL_MS) {
    console.log(`[Eventbrite] Returning ${eventbriteCache.events.length} cached events`)
    return eventbriteCache.events
  }

  const allEvents = []

  // Search queries for medical/health events
  const queries = [
    'medical health conference',
    'healthcare workshop',
    'medical seminar',
    'nursing conference',
    'clinical research',
  ]

  for (const q of queries) {
    try {
      const res = await fetch(`${EVENTBRITE_BASE}/destination/search/?token=${EVENTBRITE_TOKEN}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_search: {
            dates: 'current_future',
            page_size: 20,
            q,
          },
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.events?.results?.length) {
          allEvents.push(...data.events.results)
        }
      } else {
        console.error(`[Eventbrite] Search for "${q}" failed with status ${res.status}`)
      }
    } catch (err) {
      console.error(`[Eventbrite] Search error for "${q}":`, err.message)
    }
  }

  // Deduplicate by event ID
  const seen = new Set()
  const unique = allEvents.filter(e => {
    if (seen.has(e.id)) return false
    seen.add(e.id)
    return true
  })

  // Fetch real image URLs in parallel (batch of 10 at a time to avoid rate limits)
  const imageUrls = new Map()
  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10)
    const urls = await Promise.all(batch.map(e => resolveImageUrl(e)))
    batch.forEach((e, idx) => imageUrls.set(e.id, urls[idx]))
  }

  const mapped = unique.map(e => mapDestinationEvent(e, imageUrls.get(e.id) || ''))

  eventbriteCache = { events: mapped, fetchedAt: Date.now() }
  console.log(`[Eventbrite] Cached ${mapped.length} events at ${new Date().toISOString()}`)
  return mapped
}

// @desc    Get Eventbrite events (cached 24hr)
// @route   GET /api/events/eventbrite
export const getEventbriteEvents = async (req, res) => {
  try {
    const events = await fetchEventbriteEvents()
    res.json(events)
  } catch (error) {
    console.error('Eventbrite controller error:', error)
    res.status(500).json({ message: 'Failed to fetch Eventbrite events', error: error.message })
  }
}

// @desc    Force refresh Eventbrite cache
// @route   POST /api/events/eventbrite/refresh
export const refreshEventbriteCache = async (req, res) => {
  eventbriteCache = { events: [], fetchedAt: 0 }
  try {
    const events = await fetchEventbriteEvents()
    res.json({ message: `Cache refreshed with ${events.length} events`, events })
  } catch (error) {
    res.status(500).json({ message: 'Failed to refresh cache', error: error.message })
  }
}

// @desc    Get all events
// @route   GET /api/events
export const getEvents = async (req, res) => {
  try {
    const events = await prisma.event.findMany({
      include: { registeredUsers: { select: { id: true } } },
      orderBy: { date: 'asc' },
    })
    const eventsWithStatus = events.map(event => {
      const { registeredUsers, ...rest } = event
      return {
        ...rest,
        _id: event.id,
        registered: registeredUsers.length,
        isRegistered: req.user
          ? registeredUsers.some(u => u.id === req.user.id)
          : false,
      }
    })
    res.json(eventsWithStatus)
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Create an event
// @route   POST /api/events
export const createEvent = async (req, res) => {
  try {
    const {
      title, organizer, date, time, location, mode, type,
      shortDescription, longDescription, imageUrl, featured, capacity,
    } = req.body

    const event = await prisma.event.create({
      data: {
        title, organizer, date, time, location, mode, type,
        shortDescription, longDescription, imageUrl, featured,
        capacity: capacity || 100,
        createdById: req.user.id,
      },
    })

    res.status(201).json({ ...event, _id: event.id })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Register/unregister for an event
// @route   PUT /api/events/:id/register
export const toggleRegistration = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: { registeredUsers: { select: { id: true } } },
    })
    if (!event) return res.status(404).json({ message: 'Event not found' })

    const isRegistered = event.registeredUsers.some(u => u.id === req.user.id)

    const updated = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        registeredUsers: isRegistered
          ? { disconnect: { id: req.user.id } }
          : { connect: { id: req.user.id } },
      },
      include: { registeredUsers: { select: { id: true } } },
    })

    const { registeredUsers, ...rest } = updated
    res.json({
      ...rest,
      _id: updated.id,
      registered: registeredUsers.length,
      isRegistered: registeredUsers.some(u => u.id === req.user.id),
    })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}

// @desc    Delete an event
// @route   DELETE /api/events/:id
export const deleteEvent = async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } })
    if (!event) return res.status(404).json({ message: 'Event not found' })
    await prisma.event.delete({ where: { id: req.params.id } })
    res.json({ message: 'Event deleted' })
  } catch (error) {
    res.status(500).json({ message: error.message })
  }
}
