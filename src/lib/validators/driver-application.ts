import { z } from "zod";

export const driverApplicationSchema = z.object({
  name: z.string().trim().min(2, "Укажите имя").max(120),
  phone: z.string().trim().min(5, "Укажите телефон").max(30),
  drivingExperienceYears: z
    .number()
    .int()
    .min(0)
    .max(80)
    .optional(),
  previousDriverExperience: z.boolean(),
  consent: z.literal(true, {
    message: "Нужно согласие на обработку персональных данных",
  }),
});

export type DriverApplicationInput = z.infer<typeof driverApplicationSchema>;
