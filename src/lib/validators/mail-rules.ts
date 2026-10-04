import { z } from "zod";

// «Правила обработки писем», modelled on Яндекс.Почта.

export const RULE_FIELDS = {
  from: "От кого",
  to: "Кому",
  toOrCc: "Кому или копия",
  subject: "Тема",
  body: "Тело письма",
  attachmentName: "Название вложения",
} as const;
export type RuleField = keyof typeof RULE_FIELDS;

export const RULE_OPS = {
  contains: "содержит",
  notContains: "не содержит",
  equals: "совпадает с",
  notEquals: "не совпадает с",
} as const;
export type RuleOp = keyof typeof RULE_OPS;

export const RULE_ATTACHMENTS = {
  any: "с вложениями и без",
  with: "только с вложениями",
  without: "только без вложений",
} as const;
export type RuleAttachments = keyof typeof RULE_ATTACHMENTS;

const fieldKeys = Object.keys(RULE_FIELDS) as [RuleField, ...RuleField[]];
const opKeys = Object.keys(RULE_OPS) as [RuleOp, ...RuleOp[]];
const attachmentKeys = Object.keys(RULE_ATTACHMENTS) as [RuleAttachments, ...RuleAttachments[]];

export const ruleConditionSchema = z.object({
  field: z.enum(fieldKeys),
  op: z.enum(opKeys),
  value: z.string().trim().min(1, "Заполните значение условия").max(300),
});
export type MailRuleCondition = z.infer<typeof ruleConditionSchema>;

export const mailRuleSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    matchAll: z.boolean(),
    conditions: z.array(ruleConditionSchema).min(1, "Добавьте хотя бы одно условие").max(20),
    attachments: z.enum(attachmentKeys),
    moveTo: z.string().trim().max(300).optional(),
    markRead: z.boolean(),
    flag: z.boolean(),
    remove: z.boolean(),
    forwardTo: z.union([z.string().trim().email("Некорректный адрес для пересылки"), z.literal("")]).optional(),
    replyText: z.string().trim().max(5000).optional(),
    stopProcessing: z.boolean(),
  })
  .refine((r) => r.moveTo || r.markRead || r.flag || r.remove || r.forwardTo || r.replyText, {
    message: "Выберите хотя бы одно действие",
  });
export type MailRuleInput = z.infer<typeof mailRuleSchema>;

/** «Если От кого содержит … и Тема …» -- the rule in one line for the list. */
export function describeConditions(conditions: MailRuleCondition[], matchAll: boolean) {
  return conditions
    .map((c) => `${RULE_FIELDS[c.field]} ${RULE_OPS[c.op]} «${c.value}»`)
    .join(matchAll ? " и " : " или ");
}
