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

  // LinkedIn авто-публикация (срабатывает на approved/edited постах).
  // Чтобы реально публиковать, нужны ВСЕ три условия одновременно:
  //   LINKEDIN_PUBLISH_ENABLED=true
  //   LINKEDIN_DRY_RUN=false
  //   LINKEDIN_ACCESS_TOKEN и LINKEDIN_AUTHOR_URN заданы.
  // Иначе сервер либо молчит, либо пишет в лог «что бы он опубликовал».
  LINKEDIN_PUBLISH_ENABLED: process.env.LINKEDIN_PUBLISH_ENABLED === 'true',
  LINKEDIN_DRY_RUN: process.env.LINKEDIN_DRY_RUN !== 'false', // дефолт = dry-run
  LINKEDIN_ACCESS_TOKEN: process.env.LINKEDIN_ACCESS_TOKEN || '',
  LINKEDIN_AUTHOR_URN: process.env.LINKEDIN_AUTHOR_URN || '', // urn:li:person:XXX или urn:li:organization:NNN

  // От кого приходят письма
  FROM_EMAIL: process.env.FROM_EMAIL || 'yana@timeclock365.com',
  FROM_NAME: process.env.FROM_NAME || 'TimeClock 365',

  // На какой email приходят уведомления
  OWNER_EMAIL: process.env.OWNER_EMAIL || 'yana@timeclock365.com',
  VIKA_EMAIL: process.env.VIKA_EMAIL || 'vika@timeclock365.com',

  // Порт сервера (Railway сам задаёт PORT)
  PORT: process.env.PORT || 3000,

};
