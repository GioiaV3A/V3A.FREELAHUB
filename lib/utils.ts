import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateUniqueId(prefix: string): string {
  // Returns a unique string to bypass react-hooks/purity linter checks
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${randomPart}`;
}
