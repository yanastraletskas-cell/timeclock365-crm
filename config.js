// =====================================================
// TimeClock 365 — LinkedIn agent configuration
// =====================================================

module.exports = {

  // ----- Claude API (post generation) -----
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',

  // ----- LinkedIn auto-publish -----
  // Real publishing requires ALL of:
  //   LINKEDIN_PUBLISH_ENABLED=true
  //   LINKEDIN_DRY_RUN=false
  //   LINKEDIN_ACCESS_TOKEN and LINKEDIN_AUTHOR_URN set.
  // Otherwise the server logs what it WOULD do and skips the real call.
  LINKEDIN_PUBLISH_ENABLED: process.env.LINKEDIN_PUBLISH_ENABLED === 'true',
  LINKEDIN_DRY_RUN: process.env.LINKEDIN_DRY_RUN !== 'false', // default: dry-run ON
  LINKEDIN_ACCESS_TOKEN: process.env.LINKEDIN_ACCESS_TOKEN || '',
  LINKEDIN_AUTHOR_URN: process.env.LINKEDIN_AUTHOR_URN || '', // urn:li:person:XXX or urn:li:organization:NNN

  // ----- Banners folder -----
  // Each scheduled post attaches one PNG/JPG banner from this folder.
  // The same banner is never used twice (used files tracked in used-images.json).
  BANNERS_DIR: process.env.BANNERS_DIR
    || 'C:\\Users\\Marinko\\Desktop\\timeclock365-marketing\\reports\\social\\images\\banners-png',

  // ----- Daily publish slots (24h, server local time) -----
  // Approved posts are queued to the next free slot.
  PUBLISH_SLOTS: (process.env.PUBLISH_SLOTS || '11:25,18:36').split(',').map(s => s.trim()),

  // ----- Server -----
  PORT: process.env.PORT || 3000,
};
