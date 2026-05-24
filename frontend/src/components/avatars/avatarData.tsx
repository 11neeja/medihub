/** Avatar pools + gender-aware assignment from display name */

export interface AvatarData {
  id: number
  imageUrl: string
  fallback: string
  alt: string
}

/** Male portraits (shadcn studio) */
export const maleAvatars: AvatarData[] = [
  {
    id: 101,
    imageUrl: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-6.png",
    fallback: "HL",
    alt: "Howard Lloyd",
  },
  {
    id: 102,
    imageUrl: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-1.png",
    fallback: "JM",
    alt: "James Miller",
  },
  {
    id: 103,
    imageUrl: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-2.png",
    fallback: "RC",
    alt: "Ryan Cooper",
  },
  {
    id: 104,
    imageUrl: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-9.png",
    fallback: "DK",
    alt: "Daniel Kim",
  },
]

/** Female portraits (shadcn studio) */
export const femaleAvatars: AvatarData[] = [
  {
    id: 201,
    imageUrl: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-3.png",
    fallback: "OS",
    alt: "Olivia Sparks",
  },
  {
    id: 202,
    imageUrl: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-5.png",
    fallback: "HR",
    alt: "Hallie Richards",
  },
  {
    id: 203,
    imageUrl: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-16.png",
    fallback: "JW",
    alt: "Jenny Wilson",
  },
  {
    id: 204,
    imageUrl: "https://cdn.shadcnstudio.com/ss-assets/avatar/avatar-7.png",
    fallback: "EC",
    alt: "Emily Carter",
  },
]

/** @deprecated Use getAvatarForUser with name */
export const avatarList = [...maleAvatars, ...femaleAvatars]

const MALE_FIRST_NAMES = new Set([
  "aaron", "adam", "alex", "amit", "anthony", "arjun", "ben", "carlos", "chris",
  "daniel", "david", "dev", "ethan", "george", "howard", "james", "jason", "john",
  "jose", "karan", "kevin", "liam", "mark", "michael", "mohammed", "mohammad",
  "nathan", "neil", "nikhil", "noah", "omar", "paul", "peter", "rahul", "raj",
  "rajesh", "ravi", "richard", "robert", "rohan", "ryan", "sam", "sanjay",
  "steven", "tanmay", "thomas", "tim", "tom", "vijay", "vikram", "vraj", "william",
])

const FEMALE_FIRST_NAMES = new Set([
  "aisha", "alice", "amanda", "amy", "ananya", "anna", "ashley", "charlotte",
  "diana", "elizabeth", "emily", "emma", "grace", "hallie", "hannah", "isabella",
  "jane", "jennifer", "jenny", "jessica", "julia", "kavya", "lisa", "maria",
  "mary", "maya", "neeha", "neeja", "neha", "nehaa", "nicole", "olivia",
  "priya", "rachel", "rebecca", "sarah", "sneha", "sofia", "sophia", "suva",
  "suhani", "taylor", "victoria",
])

/** Male first names that end in "a" (avoid false female match) */
const MALE_NAMES_ENDING_IN_A = new Set(["joshua", "luca", "mustafa"])

function hashString(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/** Strip titles, digits (vraj1 → vraj), and take first given name */
export function normalizeFirstName(name: string): string {
  let cleaned = name
    .trim()
    .toLowerCase()
    .replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|miss\.?|prof\.?|sir\.?|madam\.?)\s+/i, "")
    .replace(/[^a-z\s]/g, " ")
    .trim()

  const first = cleaned.split(/\s+/).filter(Boolean)[0] ?? ""
  return first.replace(/\d+$/, "")
}

export type InferredGender = "male" | "female"

export function inferGenderFromName(name?: string): InferredGender {
  if (!name?.trim()) return "male"

  const first = normalizeFirstName(name)
  if (!first) return "male"

  if (FEMALE_FIRST_NAMES.has(first)) return "female"
  if (MALE_FIRST_NAMES.has(first)) return "male"

  // Usernames like "vraj2" — check alphabetic core
  const alphaCore = first.replace(/\d/g, "")
  if (alphaCore && alphaCore !== first) {
    if (FEMALE_FIRST_NAMES.has(alphaCore)) return "female"
    if (MALE_FIRST_NAMES.has(alphaCore)) return "male"
  }

  // Any token in full name (e.g. "Dr Neeja Suva" → neeja, suva)
  const tokens = name
    .toLowerCase()
    .replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|prof\.?)\s+/i, "")
    .split(/[\s._-]+/)
    .map((t) => t.replace(/\d+$/, ""))
    .filter((t) => t.length >= 2)

  for (const token of tokens) {
    if (FEMALE_FIRST_NAMES.has(token)) return "female"
  }
  for (const token of tokens) {
    if (MALE_FIRST_NAMES.has(token)) return "male"
  }

  if (
    first.endsWith("a") &&
    first.length >= 4 &&
    !MALE_NAMES_ENDING_IN_A.has(first) &&
    !first.endsWith("ya")
  ) {
    return "female"
  }

  if (first.endsWith("i") && first.length >= 4) {
    return "male"
  }

  return "male"
}

function pickFromPool(pool: AvatarData[], seed: string): AvatarData {
  const index = hashString(seed) % pool.length
  return pool[index]
}

export function getAvatarForUser(userId: string, name?: string): AvatarData {
  const gender = inferGenderFromName(name)
  const pool = gender === "female" ? femaleAvatars : maleAvatars
  const seed = `${userId}:${normalizeFirstName(name ?? "")}`
  return pickFromPool(pool, seed)
}

export function getAvatarImageForUser(userId: string, name?: string): string {
  return getAvatarForUser(userId, name).imageUrl
}

export function getAvatarFallbackForUser(userId: string, name?: string): string {
  if (name?.trim()) return getInitialsForName(name)
  return getAvatarForUser(userId, name).fallback
}

/** @deprecated Use getAvatarForUser(userId, name) */
export function getAvatarIdForUser(userId: string): number {
  return getAvatarForUser(userId).id
}

export function getInitialsForName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase()
}
