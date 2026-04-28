// ===================================
// НАСТРОЙКИ — ВСТАВЬ СВОИ ДАННЫЕ СЮДА
// ===================================

module.exports = {

  // Email сервис для отправки писем (SendGrid или Gmail)
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
  GMAIL_USER: process.env.GMAIL_USER || 'yana.straletskas@gmail.com',
  GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD || '',

  // Включена ли отправка email (drip + уведомления о согласовании).
  // Если EMAIL_ENABLED не задан — авто: ON только если есть GMAIL_APP_PASSWORD.
  EMAIL_ENABLED: process.env.EMAIL_ENABLED !== undefined
    ? process.env.EMAIL_ENABLED === 'true'
    : Boolean(process.env.GMAIL_APP_PASSWORD),

  // От кого приходят письма
  FROM_EMAIL: process.env.FROM_EMAIL || 'yana@timeclock365.com',
  FROM_NAME: process.env.FROM_NAME || 'TimeClock 365',

  // На какой email приходят уведомления
  OWNER_EMAIL: process.env.OWNER_EMAIL || 'yana@timeclock365.com',
  VIKA_EMAIL: process.env.VIKA_EMAIL || 'vika@timeclock365.com',

  // Порт сервера (Railway сам задаёт PORT)
  PORT: process.env.PORT || 3000,

};
