import type { MaleProfileIntake, MaleProfile, ProfileChatMessage } from './types';

export function getMaleProfileIntake(): MaleProfileIntake | null {
	if (typeof window === 'undefined') return null;
	const stored = localStorage.getItem('pdc_male_intake');
	return stored ? JSON.parse(stored) : null;
}

export function saveMaleProfileIntake(intake: MaleProfileIntake): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('pdc_male_intake', JSON.stringify(intake));
}

export function getMaleProfile(): MaleProfile | null {
	if (typeof window === 'undefined') return null;
	const stored = localStorage.getItem('pdc_male_profile');
	return stored ? JSON.parse(stored) : null;
}

export function saveMaleProfile(profile: MaleProfile): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('pdc_male_profile', JSON.stringify(profile));
}

export function getProfileChatHistory(): ProfileChatMessage[] {
	if (typeof window === 'undefined') return [];
	const stored = localStorage.getItem('pdc_profile_chat_history');
	return stored ? JSON.parse(stored) : [];
}

export function saveProfileChatHistory(messages: ProfileChatMessage[]): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem('pdc_profile_chat_history', JSON.stringify(messages));
}

export function clearProfileChatHistory(): void {
	if (typeof window === 'undefined') return;
	localStorage.removeItem('pdc_profile_chat_history');
}

export function addProfileChatMessage(message: ProfileChatMessage): void {
	const history = getProfileChatHistory();
	history.push(message);
	saveProfileChatHistory(history);
}

export function formatIntakeForPrompt(intake: MaleProfileIntake): string {
	const photoDescriptions = intake.photos
		.map((p) => `- ${p.role}: ${p.caption || p.name}`)
		.join('\n');

	return `
## User Evidence

### Photos
${photoDescriptions}

### About Him
${intake.aboutYou}

### What He's Looking For
${intake.lookingFor}

${intake.dealbreakers ? `### Deal-breakers\n${intake.dealbreakers}\n` : ''}

### Context
- Height: ${intake.height || 'Not specified'}
- Age range: ${intake.ageRange || 'Not specified'}
- Location vibe: ${intake.locationVibe}
- Education: ${intake.educationLevel}
`;
}
