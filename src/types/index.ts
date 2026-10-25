export interface Project {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: 'ai-ml' | 'fullstack' | 'cloud-devops' | 'research';
  status: 'Active R&D' | 'In Production' | 'Alpha Testing' | 'Completed';
  tags: string[];
  lead: string;
  teamSize: number;
  githubUrl?: string;
  demoUrl?: string;
  featured: boolean;
  metrics?: { label: string; value: string }[];
}

export interface Event {
  id: string;
  title: string;
  tagline: string;
  description: string;
  category: 'Hackathon' | 'Workshop' | 'Tech Summit' | 'Paper Presentation';
  date: string;
  time: string;
  venue: string;
  isVirtual: boolean;
  status: 'Upcoming' | 'Registration Open' | 'Concluded';
  maxTeamSize: number;
  minTeamSize: number;
  registeredTeamsCount: number;
  bannerGradient: string;
  prizePool?: string;
  tags: string[];
}

export interface EventTeam {
  id: string;
  eventId: string;
  teamName: string;
  leadName: string;
  leadEmail: string;
  members: {
    name: string;
    role: string;
    email: string;
  }[];
  projectIdea: string;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  shortName: string;
  description: string;
  iconName: string;
  leadName: string;
  memberCount: number;
  technologies: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  departmentId: string;
  bio: string;
  avatarUrl: string;
  skills: string[];
  githubUrl?: string;
  linkedinUrl?: string;
  featured: boolean;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  category: 'General Inquiry' | 'Project Collaboration' | 'Research Partnership' | 'Join Organisation' | 'Sponsorship';
  message: string;
  timestamp: string;
  read: boolean;
}

export interface BrandConcept {
  id: string;
  title: string;
  subtitle: string;
  rationale: string;
  geometryType: string;
  strengths: string[];
  selected?: boolean;
  monochromeRating: string;
  smallSizeLegibility: string;
  svgPath: string;
}

export type UserRole = 'Administrator' | 'Core Engineer' | 'Member' | 'Guest';

export interface UserSession {
  isLoggedIn: boolean;
  name: string;
  role: UserRole;
  email: string;
  avatar: string;
}
