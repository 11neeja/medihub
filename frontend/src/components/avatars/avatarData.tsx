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

/**
 * Curated first-name dictionaries. Dictionary lookups are the strict,
 * authoritative path — suffix heuristics below only handle names that
 * appear in neither set. Keep male names that end in "a"/"i"/"ya"
 * (krishna, ravi, aditya…) in the male set so the female-leaning
 * suffix rules never claim them.
 */
const MALE_FIRST_NAMES = new Set((
  // Indian
  "aakash aarav aayush abhay abhishek adarsh adi aditya ajay ajit akash akhil " +
  "akshay aman amar amit amol anand anil aniket anirudh ankit ankur anmol anuj " +
  "anurag arjun arnav arun arvind ashish ashok ashwin atharv atul avinash ayush " +
  "balaji bharat bhavesh chetan chirag darshan deepak dev devansh dhruv dinesh " +
  "gaurav girish gopal govind hardik hari harish harsh harshad hemant hitesh " +
  "ishaan jai jatin jay jayesh jitendra kailash kamal kapil karan kartik ketan " +
  "kishore krish krishna kunal lakshya lokesh madhav mahesh manish manoj mayank " +
  "mihir milan mohan mohit mukesh murali naman nandan naveen navin nikhil nilesh " +
  "niranjan nitin om pankaj paras parth pawan piyush prakash pranav prasad " +
  "prashant pratik praveen prem rahul raj rajat rajeev rajesh rajiv rakesh ram " +
  "raman ramesh ranjan ratan raunak ravi reyansh rishabh rishi ritesh rohan " +
  "rohit rudra sachin sagar sahil sai samar sameer sandeep sanjay sanket santosh " +
  "sarthak satish saurabh shailesh shankar shashi shiva shivam shreyas shubham " +
  "shyam siddharth sohan sourav sudhir sujal sumit sunil suraj suresh surya " +
  "tanmay tarun tejas tushar uday udit umesh utkarsh vaibhav varun vasant ved " +
  "venkat vicky vijay vikas vikram vinay vineet vinod vipul viraj vishal vishnu " +
  "vivaan vivek vraj yash yogesh yuvraj " +
  "aaditya adithya aniruddha atharva chaitanya devendra dhairya gajendra " +
  "kanha kartikeya keshav keshava madhava mahendra narendra rajendra ravindra " +
  "shaurya srinivas srinivasa surendra veer virendra dhruvil harshil jainam " +
  "kavan malav neel parthiv rushabh tirth vatsal jeet meet smit ganesh ganesha " +
  "shankara vishwa raghava yug " +
  // Muslim / Arabic
  "aamir abdul adnan ahmad ahmed akram ali altaf amaan anas anwar arbaz arman " +
  "arsalan asad ashraf asif ayaan azhar bilal danish faisal faizan farhan feroz " +
  "hamza hasan hassan hussain ibrahim imran irfan ismail javed junaid kabir " +
  "kaif khalid mahmood mohammad mohammed mohd moin mustafa nadeem nasir naushad " +
  "omar osman parvez qasim rashid rehan riyaz rizwan saad sadiq saif sajid " +
  "salman shahid shahrukh shakir sharif shoaib sohail sultan tanveer tariq umar " +
  "usman wasim yasin yusuf zaid zahid zakir zeeshan zubair " +
  // Western
  "aaron adam aiden alan albert alex alexander andrew anthony arthur austin ben " +
  "benjamin bill billy bob brad bradley brandon brian bruce caleb carl carlos " +
  "charles charlie chris christian christopher cody colin connor craig dan " +
  "daniel david dean dennis derek dominic donald douglas dylan edward elijah " +
  "eric ethan evan felix francis frank fred gabriel gary gavin george gerald " +
  "giovanni gordon graham grant greg gregory harold harry henry howard hugo ian " +
  "isaac jack jackson jacob jake james jason jayden jeff jeffrey jeremy jerry " +
  "jesse jim jimmy joe joel john johnny jonathan jordan jose joseph josh joshua " +
  "juan julian justin keith ken kenneth kevin kyle larry lawrence leo leon levi " +
  "liam lincoln logan louis luca lucas luigi luis luke marcus mark martin mason " +
  "matt matthew max michael miguel mike nathan neil nicholas nick noah oliver " +
  "oscar owen patrick paul pedro peter philip ralph randy raymond ricardo " +
  "richard rick robert roger ronald ross roy russell ryan sam samuel scott sean " +
  "sebastian shane shaun simon stephen steve steven stuart ted terry theodore " +
  "thomas tim timothy toby todd tom tommy tony travis trevor tyler victor " +
  "vincent walter warren wayne wesley will william wyatt zachary"
).split(/\s+/))

const FEMALE_FIRST_NAMES = new Set((
  // Indian
  "aaradhya aarti aditi aishwarya akanksha alka amrita anamika ananya anaya " +
  "anisha anita anjali anju ankita anushka aparna archana arpita asha ashwini " +
  "avni ayesha bharti bhavana bhavna chhavi chitra damini deepa deepali deepika " +
  "devi diksha dipti divya durga gargi gauri gayatri geeta geetha hema " +
  "indira ira isha ishani ishika ishita jaya jayshree juhi jyoti kajal kajol " +
  "kalpana kamini kanika karishma kavita kavya khushboo khushi kirti komal " +
  "kripa kriti lakshmi lata lavanya laxmi leela madhavi madhu madhuri mahima " +
  "malini mamta mansi meena meenakshi megha meghana mira mitali mona mridula " +
  "mukta myra nabha naina namrata nandini nandita neeha neeja neelam neeta " +
  "neha nehaa nidhi niharika nikita nirmala nisha nishi nitya pallavi paridhi payal " +
  "parul pinky pooja poonam prachi pragya pratibha preeti prerna priya " +
  "priyanka puja rachana radha ragini rajni rakhi ramya rani rashi rashmi " +
  "reena rekha renu rhea richa riddhi rima rina ritika ritu riya roshni ruchi " +
  "rukmini rupa sadhana sakshi sandhya sangeeta sanjana sapna sarika sarita " +
  "saroj savita seema shalini shanti sharda sharmila sheela shikha shilpa " +
  "shivani shobha shraddha shreya shruti shweta simran sita smita sneha sonal " +
  "sonali sonam sonia soumya sudha suhani sujata suman sumitra sunita supriya " +
  "surbhi sushma suva swati tanvi tanya tara trisha tulsi uma urmila urvashi " +
  "usha vaishali vandana vani varsha vasudha vidya vimla vinita yamini " +
  "chahat foram gunjan harleen heer hetal hiral jasmin jhanvi jaanvi janvi " +
  "kashish kinjal mahi minal muskaan nupur oviya palak pari rupal saloni " +
  "sheetal shital tejal twinkle vibha zeel indu meenu bhoomika bhumika " +
  "aakriti yashika lavina mahek rachita vaishnavi aishani khyati drishti " +
  "srishti dhwani ekta aastha charmi krupa dhara jinal anvi prisha aadhya " +
  "vedika harshita chandni falguni garima hansika bhavika charvi rutvi urja " +
  "vrunda krisha " +
  // Muslim / Arabic
  "aaliyah afreen aisha alia almas amina amira anam arisha asma ayat azra " +
  "bushra dua farah fariha farzana fatima firdous gulnaz hafsa haseena heena " +
  "hina huma iqra khadija kulsum lubna mahira mahnoor mariam maryam mehak " +
  "mehreen mumtaz muskan nadia nafisa nargis naseem nazia nazneen nigar nikhat " +
  "noor nusrat parveen rabia rahima rehana reshma rubina rukhsar ruksana saba " +
  "sabina sadia saima sakina salma samina sana sanam saniya sara shabana " +
  "shabnam shagufta shaheen shaista shazia shifa sultana tabassum uzma yasmin " +
  "zainab zara zeba zeenat zoya " +
  // Western
  "abigail addison adriana alexa alexandra alexis alice alicia alina allison " +
  "amanda amber amelia amy andrea angela angelina ann anna annabelle anne " +
  "annette annie april aria ariana ariel ashley aubrey audrey aurora autumn " +
  "ava avery barbara beatrice bella beth betty bianca bonnie brenda brianna " +
  "brittany brooke camila carla carmen carol caroline carolyn cassandra " +
  "catherine cathy cecilia charlotte chelsea cheryl chloe christina christine " +
  "cindy claire clara claudia colleen connie courtney crystal cynthia daisy " +
  "dana danielle daphne dawn debbie deborah debra denise diana diane dolly " +
  "dolores donna dorothy edith eileen elaine eleanor elena eliana elizabeth " +
  "ella ellen eloise elsa emilia emily emma erica erin esther eva evelyn faith " +
  "fiona florence frances gabriella gail genesis georgia gina giselle gloria " +
  "grace gracie gwen hailey hallie hannah harper hazel heather heidi helen " +
  "holly hope irene iris isabel isabella isla ivy jackie jacqueline jade jane " +
  "janet janice jasmine jean jeanette jennifer jenny jessica jill joan joanna " +
  "joanne jocelyn jodie josephine joy joyce judith judy julia julie june karen " +
  "kate katelyn katherine kathleen kathryn kathy katie kayla kelly kendra " +
  "kimberly kristen kristina kylie lacey laura lauren layla leah lena leslie " +
  "lila liliana lillian lily linda lisa lois lorraine louise lucia lucille " +
  "lucy luna lydia lynn mabel mackenzie madeline madison maggie marcia " +
  "margaret maria mariah marie marilyn marion marissa martha mary matilda " +
  "maureen maxine maya megan melanie melinda melissa melody mia michelle " +
  "mildred millie miranda miriam molly monica nancy naomi natalia natalie " +
  "nella nicole nina nora norma olive olivia paige pam pamela patricia paula " +
  "pauline pearl peggy penelope penny phoebe phyllis piper polly priscilla " +
  "quinn rachael rachel ramona reagan rebecca regina renee rhonda riley rita " +
  "roberta robin rosa rosalie rose rosemary roxanne ruby ruth sabrina sadie " +
  "sally samantha sandra sandy sarah sasha savannah scarlett selena serena " +
  "shannon sharon sheila shelby shirley sienna sierra skylar sofia sonya " +
  "sophia sophie stacey stella stephanie summer susan suzanne sydney sylvia " +
  "tamara tammy tanya tara taylor teresa terri tessa thea theresa tiffany " +
  "tina tracy valentina valerie vanessa vera veronica victoria violet vivian " +
  "wanda wendy whitney willow yolanda yvonne zoe zoey"
).split(/\s+/))

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

  // 1) Dictionary — the strict, authoritative path
  if (FEMALE_FIRST_NAMES.has(first)) return "female"
  if (MALE_FIRST_NAMES.has(first)) return "male"

  // 2) Usernames like "priya22" — check the alphabetic core
  const alphaCore = first.replace(/\d/g, "")
  if (alphaCore && alphaCore !== first) {
    if (FEMALE_FIRST_NAMES.has(alphaCore)) return "female"
    if (MALE_FIRST_NAMES.has(alphaCore)) return "male"
  }

  // 3) Any token of the full name (e.g. "Dr Neeja Suva" → neeja, suva)
  const tokens = name
    .toLowerCase()
    .replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|miss\.?|prof\.?|sir\.?|madam\.?)\s+/i, "")
    .split(/[\s._-]+/)
    .map((t) => t.replace(/[^a-z]/g, ""))
    .filter((t) => t.length >= 2)

  for (const token of tokens) {
    if (FEMALE_FIRST_NAMES.has(token)) return "female"
  }
  for (const token of tokens) {
    if (MALE_FIRST_NAMES.has(token)) return "male"
  }

  // 4) Suffix heuristics for names in neither dictionary. Male names
  //    with female-looking endings (krishna, ravi, aditya, murali…)
  //    are already caught above by the male dictionary.
  if (first.length >= 3) {
    // Masculine "-a" families first: Narendra/Devendra/Ravindra…
    if (/(endra|indra)$/.test(first)) {
      return "male"
    }
    // Distinctly feminine multi-letter endings, incl. "-ya" (riya,
    // shreya, navya) and "-i" families (aarti, shruti, anjali).
    if (/(ya|ita|ika|ini|isha|ana|ara|ella|elle|ette|ine|een|lyn|leen|thy|ley)$/.test(first)) {
      return "female"
    }
    if (first.endsWith("a") || first.endsWith("i") || first.endsWith("ee")) {
      return "female"
    }
  }

  // Consonant endings default male (rohit, harsh, aakash, dev…)
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
