import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;

export const signUpSchema = loginSchema.extend({
  fullName: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
});

export type SignUpFormValues = z.infer<typeof signUpSchema>;
