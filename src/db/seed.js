const fs = require('fs');
const path = require('path');
const { insertMunicipality } = require('./queries');

const CATEGORY_TO_SCRAPER = {
  'gov.br': 'govbr',
  'atende.net': 'atendenet',
  'com.br': 'generic',
  'other': 'generic'
};

/**
 * Reads data/municipalities.json and inserts all municipalities into the database.
 * Maps category to scraper_type.
 */
function seedMunicipalities(db) {
  const jsonPath = path.resolve(process.cwd(), 'data/municipalities.json');
  const raw = fs.readFileSync(jsonPath, 'utf-8');
  const municipalities = JSON.parse(raw);

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insertMunicipality(db, {
        name: item.municipality,
        association: item.association || null,
        site_url: item.site || '',
        news_url: item.newsUrl || null,
        category: item.category || 'other',
        scraper_type: CATEGORY_TO_SCRAPER[item.category] || 'generic',
        active: 1
      });
    }
  });

  insertMany(municipalities);
  console.log(`Seeded ${municipalities.length} municipalities`);
}

module.exports = { seedMunicipalities };
