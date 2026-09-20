import { z } from "zod";

// Separate from src/lib/validators/driver-application.ts, which validates the
// public taxi-site submission form (has a "consent" checkbox, no "status").
// This one backs the admin edit card instead (has "status", no "consent").
export const adminDriverApplicationSchema = z.object({
  name: z.string().trim().min(1, "Укажите имя"),
  phone: z.string().trim().min(1, "Укажите телефон"),
  drivingExperienceYears: z.number().int().min(0).optional(),
  previousDriverExperience: z.boolean(),
  status: z.enum(["NEW", "CONTACTED"]),
});
export type AdminDriverApplicationInput = z.infer<typeof adminDriverApplicationSchema>;
