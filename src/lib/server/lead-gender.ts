import { getSupabase } from './supabase';
import { addDays, istDay } from '$lib/ist-dates';

/**
 * Inferred gender for ad-form leads, for the two dashboard pivots that group
 * leads by who they read as.
 *
 * INFERRED, NEVER MEASURED — AND DELIBERATELY SMALL. marketing_leads has no
 * gender column: the ad-leads-daily runbook has always derived it in-session
 * from the first name and refused to make it a stored field, because it is a
 * judgment call with a real error rate (Indian first names are genuinely
 * ambiguous — Kiran, Rinku, Sai, Praneet, Chandra all go either way). Putting
 * it on a live dashboard needs *some* automated stand-in, so this is that
 * stand-in: a few hundred common names, split by gender, with everything else
 * — handles, garbled OCR-looking strings, unisex names, names this list simply
 * does not have — landing on 'unclear' rather than a guess. Treat every count
 * this produces as inferred, and expand the lists rather than guessing when a
 * name is missing.
 */

const MALE_NAMES = new Set([
	'aarav', 'abhay', 'abhishek', 'aditya', 'akash', 'akshay', 'amit', 'amol', 'anand', 'anil',
	'ankit', 'anup', 'anurag', 'arjun', 'arun', 'aryan', 'ashish', 'ashok', 'ashwin', 'avinash',
	'ayush', 'bharat', 'bharath', 'chandan', 'chirag', 'deepak', 'devendra', 'dhananjay', 'dinesh',
	'divyansh', 'faisal', 'farhan', 'gaurav', 'girish', 'gopal', 'hardik', 'harish', 'hemant',
	'imran', 'irfan', 'ishant', 'jai', 'jatin', 'javed', 'jinder', 'jitendra', 'kailash', 'kamal',
	'karan', 'kartik', 'kishore', 'kunal', 'lalit', 'lokesh', 'madan', 'mahesh', 'manav', 'manish',
	'manoj', 'mohammad', 'mohammed', 'mohan', 'monu', 'mujammil', 'mukesh', 'naresh', 'naveen',
	'nikhil', 'nilesh', 'nitin', 'om', 'pankaj', 'pawan', 'pinkesh', 'piyush', 'pradeep', 'prakash',
	'pramod', 'prashant', 'pratap', 'praveen', 'raj', 'rajat', 'rajesh', 'rajkumar', 'rakesh', 'ram',
	'ramesh', 'ramu', 'ranjan', 'ravi', 'rohit', 'rudra', 'sachin', 'saddam', 'sagar', 'sameer',
	'sandeep', 'sanjay', 'sanjeev', 'santosh', 'satish', 'shailesh', 'shakti', 'shashank', 'shiv',
	'shivam', 'shubham', 'siddharth', 'sohail', 'somnath', 'subhash', 'sudhir', 'sunil', 'suresh',
	'tapan', 'tarun', 'umar', 'umesh', 'uttam', 'varun', 'vijay', 'vikas', 'vikram', 'vinay',
	'vinod', 'vipin', 'vishal', 'vivek', 'yash', 'yogesh', 'zaid', 'zayan'
]);

const FEMALE_NAMES = new Set([
	'aarti', 'aditi', 'aishwarya', 'alka', 'ambika', 'anamika', 'anita', 'anju', 'anjali', 'ankita',
	'anupama', 'anuradha', 'arpita', 'asha', 'bharti', 'bhavna', 'bindiya', 'chandni', 'chhaya',
	'deepa', 'deepali', 'deepika', 'divya', 'falguni', 'farhana', 'gauri', 'gayatri', 'geeta', 'gita',
	'hema', 'indira', 'insha', 'isha', 'jasmine', 'jaya', 'jyoti', 'kajal', 'kajol', 'kalpana',
	'kanchan', 'kavita', 'khushabu', 'khushi', 'kinjal', 'komal', 'kumud', 'lakshmi', 'lalita',
	'lata', 'madhu', 'madhuri', 'malti', 'mamta', 'manisha', 'manju', 'manmeet', 'meena',
	'meenakshi', 'mitali', 'muskan', 'naina', 'namita', 'nandini', 'neeta', 'neha', 'nikita',
	'nirmala', 'nisha', 'pallavi', 'payal', 'pinky', 'pooja', 'poonam', 'priya', 'priyanka',
	'rachna', 'radha', 'ragini', 'rani', 'rashmi', 'rekha', 'renu', 'richa', 'ritu', 'rukhsar',
	'sadhna', 'sangeeta', 'sapna', 'sarika', 'sarita', 'savita', 'seema', 'shalini', 'shanti',
	'sheetal', 'shikha', 'shilpa', 'shobha', 'shweta', 'simran', 'sneha', 'sonal', 'sonam', 'sonia',
	'suman', 'sunidhi', 'sunita', 'sushma', 'swati', 'tanuja', 'tanvi', 'trisha', 'uma', 'urmila',
	'usha', 'vaishali', 'vandana', 'vanika', 'varsha', 'vidya', 'vimla', 'yamini', 'zara'
]);

export type InferredGender = 'male' | 'female' | 'unclear';

/**
 * First name only, ASCII-letters only after cleanup. Anything with digits,
 * emoji, non-Latin script, or not in either list falls to 'unclear' rather
 * than being guessed — see the module note.
 */
export function inferGender(firstName: string | null | undefined): InferredGender {
	if (!firstName) return 'unclear';
	const cleaned = firstName.trim().toLowerCase().replace(/[^a-z]/g, '');
	if (!cleaned) return 'unclear';
	if (MALE_NAMES.has(cleaned)) return 'male';
	if (FEMALE_NAMES.has(cleaned)) return 'female';
	return 'unclear';
}

type GenderCell = { male: number; female: number; unclear: number; total: number };

function emptyCell(): GenderCell {
	return { male: 0, female: 0, unclear: 0, total: 0 };
}

function bump(cell: GenderCell, g: InferredGender) {
	cell[g] += 1;
	cell.total += 1;
}

export type LeadGenderByDate = GenderCell & { date: string; source: 'snap_lead_form' | 'meta_lead_form' };

export type LeadGenderByAd = GenderCell & {
	date: string;
	campaignId: string | null;
	adSetId: string | null;
	adSetName: string | null;
	adName: string | null;
};

export interface LeadGenderReport {
	byDate: LeadGenderByDate[];
	snapByAd: LeadGenderByAd[];
	error?: string;
}

const AD_LEAD_SOURCES = ['snap_lead_form', 'meta_lead_form'] as const;

/**
 * Two pivots over marketing_leads, both cells-are-lead-counts:
 *  - byDate: date x source(snap/meta) x inferred gender
 *  - snapByAd: date x campaign x ad set x ad x inferred gender, Snap only
 *    (Snap is the network with real campaign/ad-set/ad ids on the row today —
 *    see 20260829183000_generalise_ad_lead_columns.sql)
 *
 * start/end are IST calendar days (same convention as buildAdAnalytics) —
 * queried with a day of UTC slack each side and re-filtered by IST day after
 * the fetch, because an IST day starts 5h30m before the UTC one.
 */
export async function buildLeadGenderReport(opts: { start: string; end: string }): Promise<LeadGenderReport> {
	const supabase = getSupabase();
	const fromIso = `${addDays(opts.start, -1)}T00:00:00.000Z`;
	const toIso = `${addDays(opts.end, 1)}T23:59:59.999Z`;

	const { data, error } = await supabase
		.from('marketing_leads')
		.select('source, first_name, submitted_at, ad_campaign_id, ad_group_id, ad_group_name, ad_name')
		.in('source', AD_LEAD_SOURCES as unknown as string[])
		.gte('submitted_at', fromIso)
		.lte('submitted_at', toIso);

	if (error) {
		console.warn('[lead-gender] marketing_leads unreadable —', error.message);
		return { byDate: [], snapByAd: [], error: error.message };
	}

	const rows = ((data ?? []) as any[]).filter((r) => {
		if (!r.submitted_at) return false;
		const d = istDay(r.submitted_at);
		return d >= opts.start && d <= opts.end;
	});

	const byDateMap = new Map<string, LeadGenderByDate>();
	const snapByAdMap = new Map<string, LeadGenderByAd>();

	for (const r of rows) {
		const date = istDay(r.submitted_at);
		const g = inferGender(r.first_name);

		const dateKey = `${date}|${r.source}`;
		const dateCell = byDateMap.get(dateKey) ?? { date, source: r.source, ...emptyCell() };
		bump(dateCell, g);
		byDateMap.set(dateKey, dateCell);

		if (r.source !== 'snap_lead_form') continue;
		const campaignId = r.ad_campaign_id ?? null;
		const adSetId = r.ad_group_id ?? null;
		const adName = r.ad_name ?? null;
		const adKey = `${date}|${campaignId}|${adSetId}|${adName}`;
		const adCell =
			snapByAdMap.get(adKey) ??
			({
				date,
				campaignId,
				adSetId,
				adSetName: r.ad_group_name ?? null,
				adName,
				...emptyCell()
			} as LeadGenderByAd);
		bump(adCell, g);
		snapByAdMap.set(adKey, adCell);
	}

	const byDate = [...byDateMap.values()].sort((a, b) =>
		a.date === b.date ? a.source.localeCompare(b.source) : a.date < b.date ? 1 : -1
	);
	const snapByAd = [...snapByAdMap.values()].sort((a, b) =>
		a.date === b.date ? b.total - a.total : a.date < b.date ? 1 : -1
	);

	return { byDate, snapByAd };
}
