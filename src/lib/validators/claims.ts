export const CLAIM_REASONS = ["Брак", "Не подошло", "Пересорт", "Другое"] as const;
export const CLAIM_STATUSES = ["Новая", "На проверке", "Принята", "Отклонена", "Закрыта"] as const;
export const CLAIM_RESOLUTIONS = ["Возврат денег", "Зачёт в следующий заказ", "Замена товара"] as const;

/** A line can be claimed once it has left the warehouse. */
export const CLAIMABLE_STATUSES = ["SHIPPED_AWAITING_PAYMENT", "DONE"] as const;

export const MAX_CLAIM_PHOTOS = 6;
