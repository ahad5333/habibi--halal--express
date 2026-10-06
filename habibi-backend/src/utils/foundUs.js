// "How did you find out about us?" -- the one-tap question after ordering
// (app order confirmation, 2026-10-06). One answer per order, from this fixed
// list only; CPanel Reports shows the totals.
const FOUND_US_SOURCES = {
  friends_family: 'Friends or family',
  google:         'Google search or Maps',
  instagram:      'Instagram',
  tiktok:         'TikTok',
  facebook:       'Facebook',
  youtube:        'YouTube',
  saw_store:      'Walked by a store',
  flyer:          'Flyer, sign or packaging',
  delivery_app:   'Uber Eats, DoorDash or Grubhub',
  other:          'Other',
};
module.exports = { FOUND_US_SOURCES };
