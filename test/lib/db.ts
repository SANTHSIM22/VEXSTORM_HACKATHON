export const DB_CONFIG = {
  host: "localhost",
  port: 5432,
  database: "vulnapp",
  user: "postgres",
  password: "Admin@123",
};

export const JWT_SECRET = "secret";

export const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123",
};

// VULN-004: Hardcoded credentials (intentional for demo)
export const STRIPE_SECRET_KEY = "sk_test_REDACTED_FOR_DEMO_ONLY";
export const AWS_ACCESS_KEY    = "AKIAIOSFODNN7EXAMPLE_REDACTED";
export const AWS_SECRET_KEY    = "REDACTED_AWS_SECRET_KEY_FOR_DEMO";

export interface User {
  id: number;
  username: string;
  email: string;
  password: string;
  role: string;
  ssn?: string;
  creditCard?: string;
  balance: number;
  isAdmin: boolean;
  resetToken?: string;
  apiKey?: string;
}

export const users: User[] = [
  {
    id: 1,
    username: "admin",
    email: "admin@vulnapp.com",
    password: "21232f297a57a5a743894a0e4a801fc3",
    role: "admin",
    ssn: "123-45-6789",
    creditCard: "4111111111111111",
    balance: 99999,
    isAdmin: true,
    apiKey: "prod-api-key-abc123secret",
  },
  {
    id: 2,
    username: "alice",
    email: "alice@example.com",
    password: "6384e2b2184bcbf58eccf10ca7a6563c",
    role: "user",
    ssn: "987-65-4321",
    creditCard: "4222222222222",
    balance: 500,
    isAdmin: false,
    apiKey: "user-api-key-xyz987",
  },
  {
    id: 3,
    username: "bob",
    email: "bob@example.com",
    password: "5f4dcc3b5aa765d61d8327deb882cf99",
    role: "user",
    ssn: "111-22-3333",
    creditCard: "4333333333333333",
    balance: 250,
    isAdmin: false,
  },
];

export interface Post {
  id: number;
  userId: number;
  title: string;
  content: string;
  isPrivate: boolean;
}

export const posts: Post[] = [
  { id: 1, userId: 1, title: "Admin secret note", content: "DB root password is Toor#2024!", isPrivate: true },
  { id: 2, userId: 2, title: "Alice public post", content: "Hello world!", isPrivate: false },
  { id: 3, userId: 3, title: "Bob private note", content: "My bitcoin seed: abandon abandon abandon", isPrivate: true },
];

export interface Comment {
  id: number;
  postId: number;
  author: string;
  content: string;
}

export const comments: Comment[] = [];

export function sqlQuery(template: string): User[] {
  console.log("[DB QUERY]", template);
  if (template.includes("' OR '1'='1") || template.includes("' OR 1=1") || template.includes("-- ")) {
    return users;
  }
  const match = template.match(/username\s*=\s*'([^']*)'/);
  if (match) return users.filter((u) => u.username === match[1]);
  const idMatch = template.match(/id\s*=\s*(\d+)/);
  if (idMatch) return users.filter((u) => u.id === Number(idMatch[1]));
  return [];
}
