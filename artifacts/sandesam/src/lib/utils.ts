import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, isToday, isYesterday, isThisYear } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMessageTime(dateString: string) {
  const date = new Date(dateString);
  return format(date, "HH:mm");
}

export function formatChatDate(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, "HH:mm");
  } else if (isYesterday(date)) {
    return "Yesterday";
  } else if (isThisYear(date)) {
    return format(date, "MMM d");
  } else {
    return format(date, "dd/MM/yyyy");
  }
}

export function getInitials(name?: string | null, phone?: string) {
  if (name) {
    return name.substring(0, 2).toUpperCase();
  }
  if (phone) {
    return phone.substring(0, 2);
  }
  return "?";
}
