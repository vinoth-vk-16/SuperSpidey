import { type Email, type InsertEmail } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getEmails(): Promise<Email[]>;
  getEmail(id: string): Promise<Email | undefined>;
  createEmail(email: InsertEmail): Promise<Email>;
}

export class MemStorage implements IStorage {
  private emails: Map<string, Email>;

  constructor() {
    this.emails = new Map();
  }

  async getEmails(): Promise<Email[]> {
    return Array.from(this.emails.values());
  }

  async getEmail(id: string): Promise<Email | undefined> {
    return this.emails.get(id);
  }

  async createEmail(insertEmail: InsertEmail): Promise<Email> {
    const id = randomUUID();
    const email: Email = { 
      ...insertEmail, 
      cc: insertEmail.cc || null,
      bcc: insertEmail.bcc || null,
      id, 
      sentAt: new Date()
    };
    this.emails.set(id, email);
    return email;
  }
}

export const storage = new MemStorage();
